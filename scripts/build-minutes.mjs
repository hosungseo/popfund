// 지방의회 회의록 (국회도서관 지방의정포털) — 107개 지역 의회의 지방소멸대응기금 논의 수집.
// CLIK_API_KEY는 빌드타임 전용. 클라이언트에서 이 API를 직접 호출하면 키가 노출된다.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw', 'minutes');
const OUT_DIR = join(ROOT, 'public', 'data', 'minutes');
const IDS_PATH = join(ROOT, 'data', 'rasmbly-ids.json');

const KEY = process.env.CLIK_API_KEY;
if (!KEY) {
  console.error('CLIK_API_KEY not set. Run with --env-file=.env.local');
  process.exit(1);
}

const BASE = 'https://clik.nanet.go.kr/openapi/minutes.do';
const KEYWORD = '지방소멸대응기금';
const DELAY_MS = 150;
const LIST_MAX = 20;   // 지역당 저장할 회의록 수
const DETAIL_MAX = 10; // 안건(MTR_SJ)까지 채울 상위 건수

const SIDO_FULL = {
  부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: '광주광역시',
  대전: '대전광역시', 경기: '경기도', 강원: '강원특별자치도', 충북: '충청북도',
  충남: '충청남도', 전북: '전북특별자치도', 전남: '전라남도', 경북: '경상북도',
  경남: '경상남도',
};
// 특별자치도 개편 이전 명칭도 허용 (회의록 메타가 과거 명칭일 수 있음)
const SIDO_ALT = { 강원: ['강원도'], 전북: ['전라북도'] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const q = new URLSearchParams({ key: KEY, type: 'json', ...params });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${BASE}?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const body = Array.isArray(data) ? data[0] : data;
      if (body.RESULT_CODE === 'ERROR09') {
        // 일별 트래픽 초과 — 재시도 무의미, 즉시 중단 신호
        const err = new Error('QUOTA_EXCEEDED: 일별 허용 트래픽 초과. 내일 재실행하면 완료분은 건너뛰고 이어서 수집합니다.');
        err.quota = true;
        throw err;
      }
      if (body.RESULT_CODE !== 'SUCCESS') throw new Error(`API ${body.RESULT_CODE}: ${body.RESULT_MESSAGE}`);
      return body;
    } catch (e) {
      if (e.quota || attempt >= 3) throw e;
      await sleep(800);
    }
  }
}

function cleanCommittee(mtgnm) {
  return (mtgnm || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Phase A: 의회 ID 발견 ──────────────────────────────────────────────────────
async function discoverIds(regions) {
  const cached = existsSync(IDS_PATH) ? JSON.parse(readFileSync(IDS_PATH, 'utf-8')) : {};
  let discovered = 0;
  for (const r of regions) {
    if (cached[r.id]) continue;
    const body = await api({
      displayType: 'list', startCount: 0, listCount: 100,
      searchType: 'RASMBLY_NM', searchKeyword: `${r.sigungu}의회`,
    });
    const rows = (body.LIST ?? []).map((x) => x.ROW);
    const fulls = [SIDO_FULL[r.sido], ...(SIDO_ALT[r.sido] ?? [])];
    if (r.id === '대구-군위군') fulls.push('경상북도');
    // 공백·표기 변형에 강건하게: 공백 제거 후 "{시도풀네임}{시군구}의회" 정확 일치
    const norm = (s) => (s || '').replace(/\s+/g, '');
    const wanted = fulls.map((f) => norm(`${f} ${r.sigungu}의회`));
    const hit = rows.find((row) => wanted.includes(norm(row.RASMBLY_NM)));
    if (hit) {
      cached[r.id] = { rasmblyId: hit.RASMBLY_ID, council: hit.RASMBLY_NM };
      discovered++;
    } else {
      const cands = [...new Set(rows.map((x) => x.RASMBLY_NM))].slice(0, 6);
      console.warn(`  [miss] ${r.id}: 의회 미발견 — 후보: ${cands.join(' | ') || '없음'}`);
    }
    await sleep(DELAY_MS);
  }
  writeFileSync(IDS_PATH, JSON.stringify(cached, null, 1), 'utf-8');
  console.log(`Phase A done — councils mapped: ${Object.keys(cached).length}/107 (+${discovered} new)`);
  return cached;
}

// ── Phase B+C: 회의록 목록 + 안건 상세 ──────────────────────────────────────────
async function fetchRegionMinutes(regionId, { rasmblyId, council }) {
  const body = await api({
    displayType: 'list', startCount: 0, listCount: LIST_MAX,
    searchType: 'MINTS_HTML', searchKeyword: KEYWORD, rasmblyId,
  });
  const items = (body.LIST ?? []).map((x) => ({
    docid: x.ROW.DOCID,
    date: x.ROW.MTG_DE,
    committee: cleanCommittee(x.ROW.MTGNM),
    sesn: x.ROW.RASMBLY_SESN,
    numpr: x.ROW.RASMBLY_NUMPR,
  }));

  for (const item of items.slice(0, DETAIL_MAX)) {
    const cachePath = join(RAW_DIR, `${item.docid}.json`);
    let detail;
    if (existsSync(cachePath)) {
      detail = JSON.parse(readFileSync(cachePath, 'utf-8'));
    } else {
      try {
        const d = await api({ displayType: 'detail', docid: item.docid });
        detail = { MTR_SJ: d.MTR_SJ ?? '' }; // MINTS_HTML(전문)은 용량 문제로 저장하지 않음
        writeFileSync(cachePath, JSON.stringify(detail), 'utf-8');
      } catch {
        detail = { MTR_SJ: '' };
      }
      await sleep(DELAY_MS);
    }
    const subject = (detail.MTR_SJ || '').replace(/\s+/g, ' ').trim();
    if (subject) item.subject = subject.slice(0, 500);
  }

  return {
    regionId, council, rasmblyId,
    keyword: KEYWORD,
    totalCount: +body.TOTAL_COUNT,
    updated: new Date().toISOString().slice(0, 10),
    items,
  };
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const regions = JSON.parse(readFileSync(join(ROOT, 'data', 'regions.json'), 'utf-8'));

  const ids = await discoverIds(regions);

  const refresh = process.argv.includes('--refresh');
  let done = 0, skipped = 0, totalMentions = 0;
  for (const r of regions) {
    if (!ids[r.id]) continue;
    const outPath = join(OUT_DIR, `${r.id}.json`);
    if (!refresh && existsSync(outPath)) {
      skipped++;
      totalMentions += JSON.parse(readFileSync(outPath, 'utf-8')).totalCount;
      continue; // 재개 모드: 완료 지역은 쿼터 절약을 위해 건너뜀 (전체 갱신은 --refresh)
    }
    const out = await fetchRegionMinutes(r.id, ids[r.id]);
    writeFileSync(outPath, JSON.stringify(out), 'utf-8');
    totalMentions += out.totalCount;
    done++;
    if (done % 20 === 0) console.log(`  [progress] ${done} fetched`);
    await sleep(DELAY_MS);
  }
  console.log(`Phase B/C done — fetched ${done}, skipped(cached) ${skipped}, 기금 언급 합계 ${totalMentions.toLocaleString()}건`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
