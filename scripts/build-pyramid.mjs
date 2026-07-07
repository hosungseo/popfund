// Age/gender pyramid data (latest completed month) for the 107 designated regions.
// Source: MOIS admmSexdAgePpltn API (data.go.kr 15108072), 10-year buckets.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw', 'pyramid');
const OUT = join(ROOT, 'public', 'data', 'age-pyramid.json');

const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error('DATA_GO_KR_KEY not set. Run with --env-file=.env.local');
  process.exit(1);
}

const BASE = 'https://apis.data.go.kr/1741000/admmSexdAgePpltn/selectAdmmSexdAgePpltn';
const DELAY_MS = 150;
const AGES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSido(sido, admmCd, ym) {
  const cachePath = join(RAW_DIR, `${sido}_${ym}.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf-8'));

  const rows = [];
  for (let page = 1; ; page++) {
    const url = `${BASE}?serviceKey=${KEY}&type=JSON&numOfRows=100&pageNo=${page}` +
      `&admmCd=${admmCd}&srchFrYm=${ym}&srchToYm=${ym}&lv=2&regSeCd=1`;
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
    if (head.resultCode !== '0') throw new Error(`${sido} ${ym}: ${head.resultMsg}`);
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
  const ym = lastCompletedYm();

  const nameToId = {};
  for (const r of regions) {
    nameToId[`${r.sido}|${r.sigungu}`] = r.id;
    if (r.id === '대구-군위군') nameToId['경북|군위군'] = r.id;
  }

  const series = {};
  for (const [sido, admmCd] of Object.entries(SIDO_ADMM)) {
    const rows = await fetchSido(sido, admmCd, ym);
    for (const row of rows) {
      const id = nameToId[`${sido}|${row.sggNm}`];
      if (!id) continue;
      series[id] = {
        male: AGES.map((a) => +row[`male${a}AgeNmprCnt`] || 0),
        female: AGES.map((a) => +row[`feml${a}AgeNmprCnt`] || 0),
      };
    }
    console.log(`  [done] ${sido}`);
    await sleep(DELAY_MS);
  }

  const missing = regions.filter((r) => !series[r.id]).map((r) => r.id);
  const out = {
    statsYm: ym,
    buckets: AGES.map((a) => (a === 100 ? '100+' : `${a}-${a + 9}`)),
    series,
  };
  writeFileSync(OUT, JSON.stringify(out), 'utf-8');
  console.log(`saved ${OUT} — ${Object.keys(series).length}/107 regions, statsYm=${ym}`);
  console.log('missing:', missing.length ? missing : 'none');
}

main().catch((e) => { console.error(e); process.exit(1); });
