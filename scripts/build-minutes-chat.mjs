// 회의록 전문 → 발언(채팅) 뷰 + 의원 프로필 수집 (v2.3, 계약 14·15번).
// CLIK_API_KEY는 빌드타임 전용. 일별 쿼터 주의: 회의록 상세 ~830콜 + 의원정보 ~84콜.
// 사용: node --env-file=.env.local scripts/build-minutes-chat.mjs [--sample N] [--parse-only]
//   --sample N   : 지역당 상세 N건만 (기본 10 = minutes/{id}.json의 subject 채운 상위 건수와 동일)
//   --parse-only : API 호출 없이 data/raw/minutes-html/ 캐시만 재파싱 (파서 개선 반복용)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HTML_DIR = join(ROOT, 'data', 'raw', 'minutes-html');
const MINUTES_DIR = join(ROOT, 'public', 'data', 'minutes');
const CHAT_DIR = join(ROOT, 'public', 'data', 'minutes-chat');
const COUNCILOR_DIR = join(ROOT, 'public', 'data', 'councilors');

const KEY = process.env.CLIK_API_KEY;
const PARSE_ONLY = process.argv.includes('--parse-only');
const SAMPLE = +(process.argv[process.argv.indexOf('--sample') + 1] || 10);
if (!KEY && !PARSE_ONLY) {
  console.error('CLIK_API_KEY not set. Run with --env-file=.env.local');
  process.exit(1);
}

const KEYWORD = '지방소멸대응기금';
const DELAY_MS = 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const body = Array.isArray(data) ? data[0] : data;
      if (body.RESULT_CODE === 'ERROR09') {
        const err = new Error('QUOTA_EXCEEDED');
        err.quota = true;
        throw err;
      }
      if (body.RESULT_CODE && body.RESULT_CODE !== 'SUCCESS') {
        throw new Error(`API ${body.RESULT_CODE}: ${body.RESULT_MESSAGE}`);
      }
      return body;
    } catch (e) {
      if (e.quota || attempt >= 3) throw e;
      await sleep(800);
    }
  }
}

// ── HTML → 발언 파서 ───────────────────────────────────────────────────────────
// 한국 지방의회 회의록 관례: 발언 시작은 "○(또는 ◯) 직위 이름" 혹은 "○이름 직위".
// 실제 마크업은 지역별로 다를 수 있으므로 태그 제거 후 텍스트 라인 기준으로 파싱한다.
const ROLES = '위원장|부위원장|위원|의장|부의장|의원|군수|시장|구청장|부군수|부시장|국장|과장|소장|실장|본부장|단장|담당관|사무국장|사무과장|읍장|면장|동장|팀장|의회사무과장';
const SPEAKER_RE = new RegExp(
  `^[○◯〇]\\s*(?:(?<role1>${ROLES})\\s*(?<name1>[가-힣]{2,5})|(?<name2>[가-힣]{2,5})\\s*(?<role2>${ROLES})|(?<only>[가-힣]{2,5}))\\s*(?<rest>.*)$`
);

function htmlToLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function parseUtterances(html) {
  const lines = htmlToLines(html);
  const utterances = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(SPEAKER_RE);
    if (m) {
      if (cur) utterances.push(cur);
      const g = m.groups;
      cur = {
        speaker: g.name1 || g.name2 || g.only || '',
        role: g.role1 || g.role2 || '',
        text: (g.rest || '').trim(),
      };
    } else if (cur) {
      cur.text += (cur.text ? ' ' : '') + line;
    }
  }
  if (cur) utterances.push(cur);
  return utterances;
}

// 키워드 발언 + 전후 1발언 컨텍스트, 생략 구간은 gap 마킹
function filterAroundKeyword(utterances, keyword) {
  const keep = new Set();
  utterances.forEach((u, i) => {
    if (u.text.includes(keyword)) {
      keep.add(i - 1); keep.add(i); keep.add(i + 1);
    }
  });
  const out = [];
  let prev = -10;
  for (let i = 0; i < utterances.length; i++) {
    if (!keep.has(i)) continue;
    const u = utterances[i];
    out.push({
      speaker: u.speaker,
      role: u.role,
      text: u.text.slice(0, 2000),
      hit: u.text.includes(keyword),
      ...(i - prev > 1 && out.length > 0 ? { gap: true } : {}),
    });
    prev = i;
  }
  return out;
}

// ── 의원정보 수집 ──────────────────────────────────────────────────────────────
async function fetchCouncilors(regionId, rasmblyId) {
  const outPath = join(COUNCILOR_DIR, `${regionId}.json`);
  if (existsSync(outPath)) return; // 재개 모드
  const url = `https://clik.nanet.go.kr/openapi/assemblyinfo.do?key=${KEY}&type=json&displayType=list&startCount=0&listCount=100&searchType=ALL&searchKeyword=&rasmblyId=${rasmblyId}`;
  const body = await api(url);
  const rows = (body.LIST ?? []).map((x) => x.ROW);
  const byName = {};
  for (const r of rows) {
    // 필드명은 실응답 기준으로 보정할 것 (ASEMBY_NM=의원명, PPRTY_NM=정당명 등 문서 기재)
    const name = (r.ASEMBY_NM || r.NAME || '').trim();
    if (!name) continue;
    byName[name] = {
      name,
      party: r.PPRTY_NM || undefined,
      district: r.ELCTNZN_NM || r.ELECTION_ZONE || undefined,
      position: r.STPOSI_NM || r.POSITION || undefined,
      committees: r.MTGNM || r.CMIT_NM || undefined,
    };
  }
  writeFileSync(outPath, JSON.stringify({
    regionId,
    updated: new Date().toISOString().slice(0, 10),
    byName,
  }), 'utf-8');
  return Object.keys(byName).length;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(HTML_DIR, { recursive: true });
  mkdirSync(CHAT_DIR, { recursive: true });
  mkdirSync(COUNCILOR_DIR, { recursive: true });
  const ids = JSON.parse(readFileSync(join(ROOT, 'data', 'rasmbly-ids.json'), 'utf-8'));

  const regionFiles = readdirSync(MINUTES_DIR).filter((f) => f.endsWith('.json'));
  let chats = 0, parsedOk = 0, parsedEmpty = 0, councilorRegions = 0;

  for (const f of regionFiles) {
    const region = JSON.parse(readFileSync(join(MINUTES_DIR, f), 'utf-8'));
    const targets = region.items.slice(0, SAMPLE);

    for (const item of targets) {
      const htmlPath = join(HTML_DIR, `${item.docid}.html`);
      const chatPath = join(CHAT_DIR, `${item.docid}.json`);
      if (existsSync(chatPath) && !PARSE_ONLY) continue;

      let html;
      if (existsSync(htmlPath)) {
        html = readFileSync(htmlPath, 'utf-8');
      } else if (PARSE_ONLY) {
        continue;
      } else {
        const d = await api(`https://clik.nanet.go.kr/openapi/minutes.do?key=${KEY}&type=json&displayType=detail&docid=${item.docid}`);
        html = d.MINTS_HTML || '';
        writeFileSync(htmlPath, html, 'utf-8');
        await sleep(DELAY_MS);
      }

      const all = parseUtterances(html);
      const utterances = filterAroundKeyword(all, KEYWORD);
      if (all.length > 0 && utterances.length > 0) parsedOk++;
      else parsedEmpty++;

      writeFileSync(chatPath, JSON.stringify({
        docid: item.docid,
        regionId: region.regionId,
        council: region.council,
        committee: item.committee,
        date: item.date,
        keyword: KEYWORD,
        utterances,
      }), 'utf-8');
      chats++;
    }

    if (!PARSE_ONLY && ids[region.regionId]) {
      const n = await fetchCouncilors(region.regionId, ids[region.regionId].rasmblyId);
      if (n !== undefined) { councilorRegions++; await sleep(DELAY_MS); }
    }
  }

  console.log(`chats written: ${chats} (발언 추출 성공 ${parsedOk} / 빈 결과 ${parsedEmpty})`);
  console.log(`councilor files new: ${councilorRegions}`);
  if (parsedEmpty > parsedOk) {
    console.warn('경고: 빈 파싱 결과가 과반 — SPEAKER_RE/htmlToLines를 실제 HTML 구조에 맞게 보정 필요.');
    console.warn(`샘플 확인: ls ${HTML_DIR} | head -3 후 head -c 3000 <파일>`);
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
