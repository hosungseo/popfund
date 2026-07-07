// Policy-analysis metrics derived from existing public/data outputs. No API calls.
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUB = join(ROOT, 'public', 'data');

const regions = JSON.parse(readFileSync(join(PUB, 'regions.json'), 'utf-8'));
const trend = JSON.parse(readFileSync(join(PUB, 'population-trend.json'), 'utf-8'));
const pyramid = JSON.parse(readFileSync(join(PUB, 'age-pyramid.json'), 'utf-8'));
const meta = JSON.parse(readFileSync(join(PUB, 'meta.json'), 'utf-8'));

function zScores(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
  return values.map((v) => (v - mean) / sd);
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// per-region metrics
const rows = regions.map((r) => {
  const series = trend.series[r.id];
  const first = series.find((v) => v != null);
  const last = [...series].reverse().find((v) => v != null);
  const declinePct = ((last - first) / first) * 100;

  const fundCum = Object.values(r.fund).reduce((a, b) => a + b, 0);
  const perCapitaFundCum = fundCum / last;

  const pyr = pyramid.series[r.id];
  const tot = pyr.male.reduce((a, b) => a + b, 0) + pyr.female.reduce((a, b) => a + b, 0);
  const elderly = pyr.male.slice(6).reduce((a, b) => a + b, 0) + pyr.female.slice(6).reduce((a, b) => a + b, 0);
  const youth = pyr.male.slice(0, 2).reduce((a, b) => a + b, 0) + pyr.female.slice(0, 2).reduce((a, b) => a + b, 0);

  // fund-project weighted execution rate
  const pj = JSON.parse(readFileSync(join(PUB, 'projects', `${r.lafCd}.json`), 'utf-8')).projects
    .filter((p) => p.fundRelated === 'confirmed' || p.fundRelated === 'candidate');
  const bdgSum = pj.reduce((a, p) => a + p.bdgCashAmt, 0);
  const epSum = pj.reduce((a, p) => a + p.epAmt, 0);

  return {
    id: r.id, sido: r.sido, sigungu: r.sigungu, type: r.type,
    latestPop: last,
    declinePct: +declinePct.toFixed(2),
    perCapitaFundCum: Math.round(perCapitaFundCum),
    fundExecRate: bdgSum > 0 ? +((epSum / bdgSum) * 100).toFixed(1) : null,
    fundProjectCount: pj.length,
    elderlyPct: +((elderly / tot) * 100).toFixed(1),
    youthPct: +((youth / tot) * 100).toFixed(1),
  };
});

// composite risk: faster decline, more elderly, fewer youth → higher risk
const zDecline = zScores(rows.map((r) => -r.declinePct));
const zElderly = zScores(rows.map((r) => r.elderlyPct));
const zYouth = zScores(rows.map((r) => -r.youthPct));
rows.forEach((r, i) => {
  r.riskScore = +((zDecline[i] + zElderly[i] + zYouth[i]) / 3).toFixed(3);
});
[...rows].sort((a, b) => b.riskScore - a.riskScore).forEach((r, i) => { r.riskRank = i + 1; });

// field portfolio from fund-projects.json
const fundProjects = JSON.parse(readFileSync(join(PUB, 'fund-projects.json'), 'utf-8'));
const byField = {};
for (const p of fundProjects) {
  const f = (byField[p.fldNm] ??= { fldNm: p.fldNm, totalBdg: 0, totalEp: 0, count: 0 });
  f.totalBdg += p.bdgCashAmt;
  f.totalEp += p.epAmt;
  f.count++;
}
const fields = Object.values(byField)
  .map((f) => ({ ...f, execRate: f.totalBdg > 0 ? +((f.totalEp / f.totalBdg) * 100).toFixed(1) : 0 }))
  .sort((a, b) => b.totalBdg - a.totalBdg);

const out = {
  basis: {
    trendRange: [trend.months[0], trend.months[trend.months.length - 1]],
    fundYears: meta.fundYears,
    pyramidYm: pyramid.statsYm,
  },
  regions: rows,
  fields,
  medians: {
    perCapitaFundCum: Math.round(median(rows.map((r) => r.perCapitaFundCum))),
    declinePct: +median(rows.map((r) => r.declinePct)).toFixed(2),
  },
};
writeFileSync(join(PUB, 'policy.json'), JSON.stringify(out), 'utf-8');

console.log(`saved policy.json — ${rows.length} regions, ${fields.length} fields`);
console.log('risk top5:', [...rows].sort((a, b) => a.riskRank - b.riskRank).slice(0, 5).map((r) => `${r.id}(${r.riskScore})`).join(', '));
const interest = rows.filter((r) => r.type === '관심');
const depopMedianRisk = median(rows.filter((r) => r.type === '감소').map((r) => r.riskScore));
console.log('감소지역 riskScore 중앙값:', depopMedianRisk.toFixed(3));
console.log('중앙값보다 위기한 관심지역:', interest.filter((r) => r.riskScore > depopMedianRisk).map((r) => r.id).join(', ') || 'none');
console.log('medians:', out.medians);
