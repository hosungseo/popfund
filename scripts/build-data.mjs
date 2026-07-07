import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const RAW_DIR = join(DATA_DIR, 'raw');
const PUBLIC_DATA_DIR = join(ROOT, 'public', 'data');

const API_KEY = process.env.LOFIN_API_KEY;
if (!API_KEY) {
  console.error('LOFIN_API_KEY not set. Run with --env-file=.env.local');
  process.exit(1);
}

const BASE_URL = 'https://www.lofin365.go.kr/lf/hub';
const DELAY_MS = 200;
const MAX_RETRIES = 3;
const EXE_YMD = '20260705';
// GJSCS의 지방소멸대응기금 재원 컬럼(lcl_dspr_cntrm_fnd_amt)은 2024 회계연도부터
// 값이 반영됨 (2022-2023은 전 지자체 0 = 미반영이므로 "0원"으로 표시하면 오해 소지)
const FUND_YEARS = ['2024', '2025', '2026'];

const CENSUS_DIR = '/Users/seohoseong/popfund-data/_census_reqdoc_1783398005042';

// Keyword heuristic for fundRelated classification
const FUND_KEYWORDS = ['지방소멸', '소멸대응', '인구감소'];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await sleep(500);
    }
  }
  throw lastErr;
}

// Extract rows from GJSCS response; throw on error code, return { totalCount, rows }
function parseGjscs(data) {
  const wrapper = data.GJSCS;
  const head = wrapper[0].head;
  const totalCount = head[0].list_total_count;
  const result = head[1].RESULT;
  if (result.CODE !== 'INFO-000') {
    throw new Error(`GJSCS API error ${result.CODE}: ${result.MESSAGE}`);
  }
  const rows = wrapper[1].row || [];
  return { totalCount, rows };
}

// Fetch all pages of GJSCS for a given fiscal year, cache as flat row array
async function fetchGjscsYear(fyr) {
  const cachePath = join(RAW_DIR, `gjscs_${fyr}.json`);
  if (existsSync(cachePath)) {
    console.log(`  [cache] GJSCS ${fyr}`);
    return JSON.parse(readFileSync(cachePath, 'utf-8'));
  }

  console.log(`  [fetch] GJSCS ${fyr} ...`);
  const url1 = `${BASE_URL}/GJSCS?Key=${API_KEY}&Type=json&pIndex=1&pSize=1000&fyr=${fyr}`;
  const first = await fetchWithRetry(url1);
  const { totalCount, rows: firstRows } = parseGjscs(first);

  const totalPages = Math.ceil(totalCount / 1000);
  const allRows = [...firstRows];
  console.log(`    total ${totalCount} rows, ${totalPages} pages`);

  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    const url = `${BASE_URL}/GJSCS?Key=${API_KEY}&Type=json&pIndex=${page}&pSize=1000&fyr=${fyr}`;
    const data = await fetchWithRetry(url);
    const { rows } = parseGjscs(data);
    allRows.push(...rows);
    console.log(`    page ${page}/${totalPages} fetched, cumulative: ${allRows.length}`);
  }

  writeFileSync(cachePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`  [saved] GJSCS ${fyr} (${allRows.length} rows)`);
  return allRows;
}

// Aggregate lcl_dspr_cntrm_fnd_amt by lafCd per year
function buildFundMap(gjscsAllYears) {
  // fundMap[lafCd][fyr] = sum
  const fundMap = {};
  for (const [fyr, rows] of Object.entries(gjscsAllYears)) {
    for (const row of rows) {
      const lafCd = row.laf_cd;
      if (!fundMap[lafCd]) fundMap[lafCd] = {};
      fundMap[lafCd][fyr] = (fundMap[lafCd][fyr] || 0) + (row.lcl_dspr_cntrm_fnd_amt || 0);
    }
  }
  return fundMap;
}

// Parse QWGJK response; throw special error on traffic-limit code 337
function parseQwgjk(data) {
  // When no data exists the API returns {"RESULT":[{"CODE":"INFO-200",...}]} instead of QWGJK wrapper
  if (!data.QWGJK) {
    const topResult = Array.isArray(data.RESULT) ? data.RESULT[0] : null;
    if (topResult && topResult.CODE === 'INFO-200') return { totalCount: 0, rows: [] };
    if (topResult && topResult.CODE === 'ERROR-337') throw new Error('TRAFFIC_LIMIT_337');
    throw new Error(`Unexpected QWGJK response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const wrapper = data.QWGJK;
  const head = wrapper[0].head;
  const totalCount = head[0].list_total_count;
  const result = head[1].RESULT;
  if (result.CODE === 'ERROR-337') throw new Error('TRAFFIC_LIMIT_337');
  if (result.CODE !== 'INFO-000') {
    throw new Error(`QWGJK API error ${result.CODE}: ${result.MESSAGE}`);
  }
  // row element is absent when totalCount is 0
  const rows = wrapper[1]?.row || [];
  return { totalCount, rows };
}

// Fetch all pages of QWGJK for one lafCd; returns raw rows and whether it was cached
async function fetchQwgjkForRegion(lafCd) {
  const cachePath = join(RAW_DIR, 'qwgjk', `${lafCd}.json`);
  if (existsSync(cachePath)) {
    return { rows: JSON.parse(readFileSync(cachePath, 'utf-8')), cached: true };
  }

  const url1 = `${BASE_URL}/QWGJK?Key=${API_KEY}&Type=json&pIndex=1&pSize=1000&fyr=2026&exe_ymd=${EXE_YMD}&laf_cd=${lafCd}`;
  const first = await fetchWithRetry(url1);
  const { totalCount, rows: firstRows } = parseQwgjk(first);

  const totalPages = Math.ceil(totalCount / 1000);
  const allRows = [...firstRows];

  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    const url = `${BASE_URL}/QWGJK?Key=${API_KEY}&Type=json&pIndex=${page}&pSize=1000&fyr=2026&exe_ymd=${EXE_YMD}&laf_cd=${lafCd}`;
    const data = await fetchWithRetry(url);
    const { rows } = parseQwgjk(data);
    allRows.push(...rows);
  }

  writeFileSync(cachePath, JSON.stringify(allRows, null, 2), 'utf-8');
  return { rows: allRows, cached: false };
}

// Load census CSVs; return map censusCode → population fields
function loadCensus() {
  const census = {};

  function readCsv(fileName) {
    const path = join(CENSUS_DIR, fileName);
    return readFileSync(path, 'utf-8').split('\n');
  }

  // 총인구 file: to_in_001=total, to_in_007=male, to_in_008=female
  for (const line of readCsv('(행정구역)2025년기준_2024년_인구총괄(총인구).csv')) {
    const parts = line.trim().split(',');
    if (parts.length < 4) continue;
    const [, code, indicator, val] = parts;
    if (code.length !== 5) continue;
    if (!census[code]) census[code] = {};
    const n = Math.round(parseFloat(val));
    if (indicator === 'to_in_001') census[code].total = n;
    else if (indicator === 'to_in_007') census[code].male = n;
    else if (indicator === 'to_in_008') census[code].female = n;
  }

  // Single-indicator files
  const single = [
    { file: '(행정구역)2025년기준_2024년_인구총괄(인구밀도).csv', code: 'to_in_003', key: 'density', parse: parseFloat },
    { file: '(행정구역)2025년기준_2024년_인구총괄(평균나이).csv', code: 'to_in_002', key: 'avgAge', parse: parseFloat },
    { file: '(행정구역)2025년기준_2024년_인구총괄(노령화지수).csv', code: 'to_in_004', key: 'agingIndex', parse: parseFloat },
    { file: '(행정구역)2025년기준_2024년_인구총괄(유년부양비).csv', code: 'to_in_006', key: 'youthDependency', parse: parseFloat },
    { file: '(행정구역)2025년기준_2024년_인구총괄(노년부양비).csv', code: 'to_in_005', key: 'oldAgeDependency', parse: parseFloat },
  ];

  for (const { file, code: indicator, key, parse } of single) {
    for (const line of readCsv(file)) {
      const parts = line.trim().split(',');
      if (parts.length < 4) continue;
      const [, censusCode, ind, val] = parts;
      if (censusCode.length !== 5 || ind !== indicator) continue;
      if (!census[censusCode]) census[censusCode] = {};
      census[censusCode][key] = parse(val);
    }
  }

  return census;
}

// Load project_map.csv → Map<dbizCd, 'confirmed'|'excluded'>
function loadProjectMap() {
  const mapPath = join(DATA_DIR, 'project_map.csv');
  const map = new Map();
  if (!existsSync(mapPath)) return map;
  const lines = readFileSync(mapPath, 'utf-8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const [dbizCd, status] = lines[i].split(',');
    if (dbizCd && status && (status.trim() === 'confirmed' || status.trim() === 'excluded')) {
      map.set(dbizCd.trim(), status.trim());
    }
  }
  return map;
}

// Classify a project as confirmed/excluded/candidate/null
function classifyProject(dbizCd, dbizNm, projectMap) {
  if (projectMap.has(dbizCd)) return projectMap.get(dbizCd);
  if (FUND_KEYWORDS.some((kw) => dbizNm.includes(kw))) return 'candidate';
  return null;
}

// Map raw QWGJK rows → contract Project shape.
// QWGJK splits one 세부사업 across multiple rows (부서 등 단위), so amounts
// must be summed per (dbizCd, acntDvNm) — 회계구분이 다르면 별도 항목으로 유지.
function rowsToProjects(rows, projectMap) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.dbiz_cd}|${row.acnt_dv_nm}`;
    let p = byKey.get(key);
    if (!p) {
      p = {
        dbizCd: row.dbiz_cd,
        dbizNm: row.dbiz_nm,
        acntDvNm: row.acnt_dv_nm,
        fldNm: row.fld_nm,
        partNm: row.part_nm,
        bdgCashAmt: 0,
        bdgNtep: 0,
        capep: 0,
        sggep: 0,
        etcAmt: 0,
        epAmt: 0,
        cplAmt: 0,
        fundRelated: classifyProject(row.dbiz_cd, row.dbiz_nm, projectMap),
      };
      byKey.set(key, p);
    }
    p.bdgCashAmt += row.bdg_cash_amt || 0;
    p.bdgNtep += row.bdg_ntep || 0;
    p.capep += row.capep || 0;
    p.sggep += row.sggep || 0;
    p.etcAmt += row.etc_amt || 0;
    p.epAmt += row.ep_amt || 0;
    p.cplAmt += row.cpl_amt || 0;
  }
  return [...byKey.values()];
}

async function main() {
  ensureDir(RAW_DIR);
  ensureDir(join(RAW_DIR, 'qwgjk'));
  ensureDir(PUBLIC_DATA_DIR);
  ensureDir(join(PUBLIC_DATA_DIR, 'projects'));

  // Load master regions
  const regions = JSON.parse(readFileSync(join(DATA_DIR, 'regions.json'), 'utf-8'));
  console.log(`Loaded ${regions.length} regions from data/regions.json`);

  // Ensure project_map.csv exists (template if missing)
  const mapPath = join(DATA_DIR, 'project_map.csv');
  if (!existsSync(mapPath)) {
    writeFileSync(mapPath, 'dbiz_cd,status,note\n', 'utf-8');
    console.log('Created data/project_map.csv (template)');
  }
  const projectMap = loadProjectMap();

  // --- GJSCS: fund data 2024-2026 ---
  console.log('\n=== GJSCS: collecting fund data (2024-2026) ===');
  const gjscsAllYears = {};
  for (const fyr of FUND_YEARS) {
    gjscsAllYears[fyr] = await fetchGjscsYear(fyr);
    await sleep(DELAY_MS);
  }
  const fundMap = buildFundMap(gjscsAllYears);
  console.log(`Fund map built for ${Object.keys(fundMap).length} lafCd entries`);

  // --- Census ---
  console.log('\n=== Census: loading population data ===');
  const censusData = loadCensus();
  console.log(`Census loaded for ${Object.keys(censusData).length} census codes`);

  // --- QWGJK: per-region project data ---
  console.log('\n=== QWGJK: collecting project data (107 regions) ===');
  let qwgjkSuccess = 0;
  let qwgjkFailed = 0;
  const failedLafCds = [];
  let trafficLimitHit = false;
  let trafficLimitAt = null;

  for (const region of regions) {
    if (trafficLimitHit) {
      failedLafCds.push(region.lafCd);
      continue;
    }

    await sleep(DELAY_MS);

    try {
      const { rows, cached } = await fetchQwgjkForRegion(region.lafCd);
      const projects = rowsToProjects(rows, projectMap);

      writeFileSync(
        join(PUBLIC_DATA_DIR, 'projects', `${region.lafCd}.json`),
        JSON.stringify({ lafCd: region.lafCd, exeYmd: EXE_YMD, projects }, null, 2),
        'utf-8',
      );

      if (!cached) {
        console.log(`  [ok] ${region.id} ${region.lafCd}: ${rows.length} projects`);
      }
      qwgjkSuccess++;
    } catch (e) {
      if (e.message === 'TRAFFIC_LIMIT_337') {
        trafficLimitHit = true;
        trafficLimitAt = region.id;
        failedLafCds.push(region.lafCd);
        console.error(`\n[STOP] Daily traffic limit (337) hit at ${region.id}. Remaining regions skipped.`);
      } else {
        console.error(`  [fail] ${region.id} ${region.lafCd}: ${e.message}`);
        qwgjkFailed++;
        failedLafCds.push(region.lafCd);
      }
    }
  }

  // --- Build public/data/regions.json ---
  console.log('\n=== Building public/data/regions.json ===');
  const outputRegions = regions.map((region) => {
    const c = censusData[region.censusCode] || {};
    const fund = {};
    for (const fyr of FUND_YEARS) {
      fund[fyr] = (fundMap[region.lafCd] || {})[fyr] || 0;
    }
    return {
      ...region,
      population: {
        total: c.total ?? 0,
        male: c.male ?? 0,
        female: c.female ?? 0,
        density: c.density ?? null,
        avgAge: c.avgAge ?? null,
        agingIndex: c.agingIndex ?? null,
        youthDependency: c.youthDependency ?? null,
        oldAgeDependency: c.oldAgeDependency ?? null,
      },
      fund,
    };
  });

  writeFileSync(
    join(PUBLIC_DATA_DIR, 'regions.json'),
    JSON.stringify(outputRegions, null, 2),
    'utf-8',
  );
  console.log(`Written public/data/regions.json (${outputRegions.length} regions)`);

  // --- Build public/data/meta.json ---
  const meta = {
    builtAt: new Date().toISOString(),
    exeYmd: EXE_YMD,
    fundYears: FUND_YEARS,
    censusYear: '2024',
    sources: [
      '지방재정365 GJSCS 기능별 재원별 세출예산 (2024-2026)',
      '지방재정365 QWGJK 세부사업별 세출현황 스냅샷 (exe_ymd=20260705)',
      '통계청 2024 인구총조사 (2025년 기준 제공)',
    ],
  };
  writeFileSync(join(PUBLIC_DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  console.log('Written public/data/meta.json');

  // --- Final summary ---
  console.log('\n========== Build Summary ==========');
  console.log(`Regions:     ${outputRegions.length}`);
  console.log(`QWGJK ok:    ${qwgjkSuccess}`);
  console.log(`QWGJK fail:  ${qwgjkFailed}`);
  if (trafficLimitHit) console.log(`Traffic limit hit at: ${trafficLimitAt}`);
  if (failedLafCds.length) console.log(`Failed lafCds: ${failedLafCds.join(', ')}`);

  // Top 5 by 2024-2026 cumulative fund
  const ranked = outputRegions
    .map((r) => ({ id: r.id, total: Object.values(r.fund).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  console.log('\nTop 5 cumulative fund (2024-2026):');
  ranked.forEach((r, i) => console.log(`  ${i + 1}. ${r.id}: ${r.total.toLocaleString()}원`));

  // Census coverage
  const missing = outputRegions.filter((r) => r.population.total === 0);
  if (missing.length) {
    console.log(`\nWARN: ${missing.length} regions with population.total=0:`);
    missing.forEach((r) => console.log(`  ${r.id} censusCode=${r.censusCode}`));
  }

  if (trafficLimitHit || qwgjkFailed > 0) {
    console.log('\nWARNING: Some QWGJK data missing. Re-run to resume from cache.');
  } else {
    console.log('\nBuild complete.');
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
