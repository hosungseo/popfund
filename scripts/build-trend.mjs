// Monthly resident-registration population trend for the 107 designated regions.
// Source: MOIS admmPpltnHhStus API (data.go.kr 15108065).
// The API only serves data from 2022-10 onward, in windows of at most 3 months.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw', 'trend');
const OUT = join(ROOT, 'public', 'data', 'population-trend.json');

const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error('DATA_GO_KR_KEY not set. Run with --env-file=.env.local');
  process.exit(1);
}

const BASE = 'https://apis.data.go.kr/1741000/admmPpltnHhStus/selectAdmmPpltnHhStus';
const FIRST_YM = '202210'; // earliest month the API serves
const DELAY_MS = 150;

// 10-digit MOIS admin codes for the 13 sidos containing designated regions
const SIDO_ADMM = {
  부산: '2600000000', 대구: '2700000000', 인천: '2800000000', 광주: '2900000000',
  대전: '3000000000', 경기: '4100000000', 강원: '5100000000', 충북: '4300000000',
  충남: '4400000000', 전북: '5200000000', 전남: '4600000000', 경북: '4700000000',
  경남: '4800000000',
};

function lastCompletedYm() {
  // resident stats are compiled at month end; previous month is the latest safe bet
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(fromYm, toYm) {
  const months = [];
  let y = +fromYm.slice(0, 4), m = +fromYm.slice(4);
  while (`${y}${String(m).padStart(2, '0')}` <= toYm) {
    months.push(`${y}${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWindow(sido, admmCd, frYm, toYm) {
  const cachePath = join(RAW_DIR, `${sido}_${frYm}_${toYm}.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf-8'));

  const rows = [];
  for (let page = 1; ; page++) {
    const url = `${BASE}?serviceKey=${KEY}&type=JSON&numOfRows=100&pageNo=${page}` +
      `&admmCd=${admmCd}&srchFrYm=${frYm}&srchToYm=${toYm}&lv=2&regSeCd=1`;
    let data;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        if (attempt >= 3) throw e;
        await sleep(700);
      }
    }
    const head = data.Response.head;
    if (head.resultCode !== '0') {
      if (head.resultMsg === 'NODATA_ERROR') break;
      throw new Error(`${sido} ${frYm}-${toYm}: ${head.resultMsg}`);
    }
    const items = data.Response.items?.item ?? [];
    rows.push(...(Array.isArray(items) ? items : [items]));
    if (rows.length >= +head.totalCount) break;
    await sleep(DELAY_MS);
  }
  writeFileSync(cachePath, JSON.stringify(rows), 'utf-8');
  return rows;
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  const regions = JSON.parse(readFileSync(join(ROOT, 'data', 'regions.json'), 'utf-8'));
  const months = monthRange(FIRST_YM, lastCompletedYm());

  // (sido, sggNm) -> regionId; 군위군 appears under 경북 before 2023-07, 대구 after
  const nameToId = {};
  for (const r of regions) {
    nameToId[`${r.sido}|${r.sigungu}`] = r.id;
    if (r.id === '대구-군위군') nameToId['경북|군위군'] = r.id;
  }

  // series[regionId][ym] = total population
  const series = {};
  for (const r of regions) series[r.id] = {};

  for (const [sido, admmCd] of Object.entries(SIDO_ADMM)) {
    for (let i = 0; i < months.length; i += 3) {
      const frYm = months[i];
      const toYm = months[Math.min(i + 2, months.length - 1)];
      const rows = await fetchWindow(sido, admmCd, frYm, toYm);
      for (const row of rows) {
        const id = nameToId[`${sido}|${row.sggNm}`];
        if (!id) continue;
        series[id][row.statsYm] = +row.totNmprCnt;
      }
      await sleep(DELAY_MS);
    }
    console.log(`  [done] ${sido}`);
  }

  // align to compact arrays; null where a month is missing
  const out = {
    designatedYm: '202110', // 인구감소지역 최초 지정 고시
    firstYm: FIRST_YM,      // API 제공 시작점 (2021-10~2022-09 데이터는 원천 미제공)
    months,
    series: Object.fromEntries(
      Object.entries(series).map(([id, byYm]) => [id, months.map((ym) => byYm[ym] ?? null)])
    ),
  };
  writeFileSync(OUT, JSON.stringify(out), 'utf-8');

  const missing = Object.entries(out.series)
    .map(([id, arr]) => [id, arr.filter((v) => v == null).length])
    .filter(([, n]) => n > 0);
  console.log(`saved ${OUT} — ${months.length} months x ${regions.length} regions`);
  console.log('regions with missing months:', missing.length ? missing : 'none');
}

main().catch((e) => { console.error(e); process.exit(1); });
