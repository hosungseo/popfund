// Monthly birth registrations and death removals for the 107 designated regions.
// Sources (data.go.kr — REQUIRES 활용신청 on each before this works):
//   출생: 15108075 admmSexdBrthReg  | 사망: 15108077 admmSexdAgeErsr
// Same MOIS API family as build-trend.mjs: 2022-10 onward, 3-month windows.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw', 'vital');
const OUT = join(ROOT, 'public', 'data', 'vital-trend.json');

const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error('DATA_GO_KR_KEY not set. Run with --env-file=.env.local');
  process.exit(1);
}

const SERVICES = {
  births: 'admmSexdBrthReg/selectAdmmSexdBrthReg',
  deaths: 'admmSexdAgeErsr/selectAdmmSexdAgeErsr',
};
const FIRST_YM = '202210';
const DELAY_MS = 150;

const SIDO_ADMM = {
  부산: '2600000000', 대구: '2700000000', 인천: '2800000000', 광주: '2900000000',
  대전: '3000000000', 경기: '4100000000', 강원: '5100000000', 충북: '4300000000',
  충남: '4400000000', 전북: '5200000000', 전남: '4600000000', 경북: '4700000000',
  경남: '4800000000',
};

function lastCompletedYm() {
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

async function fetchWindow(kind, sido, admmCd, frYm, toYm) {
  const cachePath = join(RAW_DIR, `${kind}_${sido}_${frYm}_${toYm}.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf-8'));

  const rows = [];
  for (let page = 1; ; page++) {
    const url = `https://apis.data.go.kr/1741000/${SERVICES[kind]}?serviceKey=${KEY}` +
      `&type=JSON&numOfRows=100&pageNo=${page}` +
      `&admmCd=${admmCd}&srchFrYm=${frYm}&srchToYm=${toYm}&lv=2&regSeCd=1`;
    let data;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url);
        if (res.status === 403) {
          throw new Error(
            `403 Forbidden — data.go.kr에서 ${kind === 'births' ? '출생등록자수(15108075)' : '사망말소자수(15108077)'} 활용신청이 필요합니다.`
          );
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        if (String(e.message).startsWith('403')) throw e;
        if (attempt >= 3) throw e;
        await sleep(700);
      }
    }
    const head = data.Response.head;
    if (head.resultCode !== '0') {
      if (head.resultMsg === 'NODATA_ERROR') break;
      throw new Error(`${kind} ${sido} ${frYm}-${toYm}: ${head.resultMsg}`);
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

  const nameToId = {};
  for (const r of regions) {
    nameToId[`${r.sido}|${r.sigungu}`] = r.id;
    if (r.id === '대구-군위군') nameToId['경북|군위군'] = r.id;
  }

  const series = {};
  for (const r of regions) series[r.id] = { births: {}, deaths: {} };

  for (const kind of ['births', 'deaths']) {
    for (const [sido, admmCd] of Object.entries(SIDO_ADMM)) {
      for (let i = 0; i < months.length; i += 3) {
        const frYm = months[i];
        const toYm = months[Math.min(i + 2, months.length - 1)];
        const rows = await fetchWindow(kind, sido, admmCd, frYm, toYm);
        for (const row of rows) {
          const id = nameToId[`${sido}|${row.sggNm}`];
          if (!id) continue;
          series[id][kind][row.statsYm] = +row.totNmprCnt;
        }
        await sleep(DELAY_MS);
      }
      console.log(`  [done] ${kind} ${sido}`);
    }
  }

  const out = {
    firstYm: FIRST_YM,
    months,
    series: Object.fromEntries(
      Object.entries(series).map(([id, s]) => [id, {
        births: months.map((ym) => s.births[ym] ?? null),
        deaths: months.map((ym) => s.deaths[ym] ?? null),
      }])
    ),
  };
  writeFileSync(OUT, JSON.stringify(out), 'utf-8');
  console.log(`saved ${OUT} — ${months.length} months x ${regions.length} regions`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
