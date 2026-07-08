// 지역별 논의 주제 프로필 (v2.7) — minutes-chat/*.json(발언) + minutes/*.json(안건)에서
// 규칙 기반 주제 분류. API 호출 없음. 출력: public/data/minutes-topics.json
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAT_DIR = join(ROOT, 'public', 'data', 'minutes-chat');
const MIN_DIR = join(ROOT, 'public', 'data', 'minutes');
const OUT = join(ROOT, 'public', 'data', 'minutes-topics.json');

// 주제 사전 — 실데이터 키워드 빈도 분석(2026-07-09) 기반
const TOPICS = [
  ['청년',      /청년/],
  ['주거·주택', /주거|주택|임대|빈집/],
  ['관광·축제', /관광|축제|워케이션|숙박|펜션|체류형/],
  ['일자리·창업', /일자리|창업|취업/],
  ['의료·돌봄', /의료|돌봄|병원|보건/],
  ['생활인구',  /생활인구|체류인구/],
  ['귀농귀촌',  /귀농|귀촌|정착지원/],
  ['교육',      /교육|학교|돌봄교실/],
  ['집행 문제', /집행률|불용|이월|반납|집행부진|미집행/],
  ['공모·평가', /공모|성과평가|평가결과/],
];

const AGENDA_TYPES = [
  ['예산안 심사', /예산안|추가경정|추경/],
  ['기금운용계획', /기금운용계획/],
  ['업무보고', /업무보고|업무계획|주요업무/],
  ['조례', /조례/],
  ['공유재산·위탁', /공유재산|위탁|위수탁/],
  ['결산', /결산/],
  ['행정사무감사', /행정사무감사/],
];

// 지역별 텍스트 수집
const regionTexts = {}; // regionId -> {texts: [], dates: []}
for (const f of readdirSync(CHAT_DIR).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(CHAT_DIR, f), 'utf-8'));
  const bucket = (regionTexts[d.regionId] ??= { texts: [], dates: [] });
  for (const u of d.utterances) {
    if (u.hit) {
      bucket.texts.push(u.text);
      bucket.dates.push(d.date);
    }
  }
}
// 안건도 주제 신호로 (subject는 minutes/{id}.json)
for (const f of readdirSync(MIN_DIR).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(MIN_DIR, f), 'utf-8'));
  const bucket = (regionTexts[d.regionId] ??= { texts: [], dates: [] });
  for (const it of d.items) {
    if (it.subject) bucket.texts.push(it.subject);
  }
}

const regions = {};
const globalTopics = Object.fromEntries(TOPICS.map(([k]) => [k, 0]));
let firstDate = '99999999', lastDate = '00000000';

for (const [regionId, { texts, dates }] of Object.entries(regionTexts)) {
  const counts = {};
  for (const [label, re] of TOPICS) {
    const n = texts.filter((t) => re.test(t)).length;
    if (n > 0) {
      counts[label] = n;
      globalTopics[label] += n;
    }
  }
  for (const dt of dates) {
    if (dt < firstDate) firstDate = dt;
    if (dt > lastDate) lastDate = dt;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  regions[regionId] = { topics: sorted.slice(0, 5) };
}

// 전국 안건 유형 분포
const agendaTotals = Object.fromEntries(AGENDA_TYPES.map(([k]) => [k, 0]));
for (const f of readdirSync(MIN_DIR).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(MIN_DIR, f), 'utf-8'));
  for (const it of d.items) {
    if (!it.subject) continue;
    for (const [label, re] of AGENDA_TYPES) {
      if (re.test(it.subject)) agendaTotals[label]++;
    }
  }
}

const out = {
  global: {
    // 본문 검증(발언 존재) 회의 기준 기간 — 형태소 과매칭 제외
    period: [firstDate, lastDate],
    topics: Object.entries(globalTopics).sort((a, b) => b[1] - a[1]),
    agendaTypes: Object.entries(agendaTotals).sort((a, b) => b[1] - a[1]),
  },
  regions,
};
writeFileSync(OUT, JSON.stringify(out), 'utf-8');

const withTopics = Object.values(regions).filter((r) => r.topics.length > 0).length;
console.log(`saved minutes-topics.json — ${Object.keys(regions).length} regions (주제 있음 ${withTopics})`);
console.log('기간:', out.global.period.join(' ~ '));
console.log('전국 주제:', out.global.topics.slice(0, 6));
