import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DATA_DIR = join(ROOT, 'public', 'data');

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  [FAIL] ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  [WARN] ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  [ok]   ${msg}`);
}

// --- meta.json ---
console.log('\n=== meta.json ===');
const metaPath = join(PUBLIC_DATA_DIR, 'meta.json');
if (!existsSync(metaPath)) {
  fail('public/data/meta.json missing');
} else {
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  if (!meta.builtAt) fail('meta.builtAt missing');
  else ok(`builtAt: ${meta.builtAt}`);
  if (!meta.exeYmd) fail('meta.exeYmd missing');
  else ok(`exeYmd: ${meta.exeYmd}`);
  if (!Array.isArray(meta.fundYears) || meta.fundYears.length === 0) fail('meta.fundYears missing');
  else ok(`fundYears: ${meta.fundYears.join(', ')}`);
  if (!meta.censusYear) fail('meta.censusYear missing');
  else ok(`censusYear: ${meta.censusYear}`);
}

// --- regions.json ---
console.log('\n=== public/data/regions.json ===');
const regionsPath = join(PUBLIC_DATA_DIR, 'regions.json');
if (!existsSync(regionsPath)) {
  fail('public/data/regions.json missing');
  process.exit(1);
}

const regions = JSON.parse(readFileSync(regionsPath, 'utf-8'));
ok(`Loaded ${regions.length} regions`);

if (regions.length !== 107) {
  fail(`Expected 107 regions, got ${regions.length}`);
} else {
  ok('Region count: 107');
}

// Required fields on each region
let popZero = 0;
let popMissing = 0;
let fundMissing = 0;
let fundAllZero = 0;

for (const r of regions) {
  // population checks
  if (!r.population) {
    popMissing++;
  } else if (r.population.total <= 0) {
    popZero++;
    warn(`${r.id} (censusCode=${r.censusCode}): population.total=${r.population.total}`);
  }

  // fund checks
  if (!r.fund) {
    fundMissing++;
  } else {
    const years = Object.keys(r.fund);
    if (years.length === 0) {
      fundMissing++;
    } else if (Object.values(r.fund).every((v) => v === 0)) {
      fundAllZero++;
    }
  }

  // required scalar fields
  for (const field of ['id', 'sido', 'sigungu', 'type', 'lafCd', 'censusCode']) {
    if (!r[field]) fail(`${r.id || '?'}: missing field "${field}"`);
  }
}

if (popMissing > 0) fail(`${popMissing} regions missing population object`);
else ok('All regions have population object');

if (popZero > 0) fail(`${popZero} regions with population.total <= 0`);
else ok('All regions have population.total > 0');

if (fundMissing > 0) fail(`${fundMissing} regions missing fund object or years`);
else ok('All regions have fund key');

if (fundAllZero > 0) warn(`${fundAllZero} regions with all-zero fund values (may be expected)`);
else ok('At least some fund values non-zero across all regions');

// --- projects files ---
console.log('\n=== public/data/projects/ ===');
const projectsDir = join(PUBLIC_DATA_DIR, 'projects');
if (!existsSync(projectsDir)) {
  fail('public/data/projects/ directory missing');
} else {
  const projectFiles = readdirSync(projectsDir).filter((f) => f.endsWith('.json'));
  ok(`Found ${projectFiles.length} project files`);

  if (projectFiles.length !== 107) {
    fail(`Expected 107 project files, got ${projectFiles.length}`);
  } else {
    ok('Project file count: 107');
  }

  // Verify each region has a project file
  const regionLafCds = new Set(regions.map((r) => r.lafCd));
  const fileLafCds = new Set(projectFiles.map((f) => f.replace('.json', '')));
  const missing = [...regionLafCds].filter((c) => !fileLafCds.has(c));
  if (missing.length > 0) fail(`Missing project files for lafCd: ${missing.join(', ')}`);
  else ok('All 107 regions have a project file');

  // Spot-check schema of first 10 files
  let schemaErrors = 0;
  const required = ['dbizCd', 'dbizNm', 'acntDvNm', 'fldNm', 'partNm', 'bdgCashAmt', 'bdgNtep', 'capep', 'sggep', 'etcAmt', 'epAmt', 'cplAmt', 'fundRelated'];
  for (const file of projectFiles.slice(0, 10)) {
    const p = JSON.parse(readFileSync(join(projectsDir, file), 'utf-8'));
    if (!p.lafCd || !p.exeYmd || !Array.isArray(p.projects)) {
      fail(`${file}: invalid RegionProjects shape`);
      schemaErrors++;
      continue;
    }
    for (const proj of p.projects.slice(0, 3)) {
      for (const field of required) {
        if (!(field in proj)) {
          fail(`${file}: project missing field "${field}"`);
          schemaErrors++;
        }
      }
    }
  }
  if (schemaErrors === 0) ok('Schema spot-check passed (first 10 files)');

  // Count candidate projects across all files
  let candidateCount = 0;
  let confirmedCount = 0;
  for (const file of projectFiles) {
    const p = JSON.parse(readFileSync(join(projectsDir, file), 'utf-8'));
    for (const proj of p.projects) {
      if (proj.fundRelated === 'candidate') candidateCount++;
      if (proj.fundRelated === 'confirmed') confirmedCount++;
    }
  }
  ok(`fundRelated summary: confirmed=${confirmedCount}, candidate=${candidateCount}`);
}

// --- v1.5: similar shards ---
console.log('\n=== public/data/similar/ (v1.5) ===');
const similarDir = join(PUBLIC_DATA_DIR, 'similar');
if (!existsSync(similarDir)) {
  fail('public/data/similar/ directory missing');
} else {
  const shardFiles = readdirSync(similarDir).filter((f) => f.endsWith('.json'));
  if (shardFiles.length !== 256) {
    fail(`Expected 256 shard files, got ${shardFiles.length}`);
  } else {
    ok('Shard count: 256');
  }

  // Count total keys across all shards
  let totalShardKeys = 0;
  for (const file of shardFiles) {
    const shard = JSON.parse(readFileSync(join(similarDir, file), 'utf-8'));
    totalShardKeys += Object.keys(shard).length;
  }
  ok(`Total shard keys: ${totalShardKeys}`);
  if (totalShardKeys <= 10000) {
    fail(`Expected >10000 total shard keys, got ${totalShardKeys}`);
  } else {
    ok(`Shard total keys > 10000: ${totalShardKeys}`);
  }
}

// --- v1.5: fund-projects.json ---
console.log('\n=== public/data/fund-projects.json (v1.5) ===');
const fundProjectsPath = join(PUBLIC_DATA_DIR, 'fund-projects.json');
if (!existsSync(fundProjectsPath)) {
  fail('public/data/fund-projects.json missing');
} else {
  const fundProjects = JSON.parse(readFileSync(fundProjectsPath, 'utf-8'));
  ok(`fund-projects count: ${fundProjects.length}`);
  if (fundProjects.length < 400) {
    fail(`Expected >= 400 fund projects, got ${fundProjects.length}`);
  } else {
    ok(`fund-projects >= 400: ${fundProjects.length}`);
  }
  // Spot-check required fields
  const fpRequired = ['regionId', 'lafCd', 'sido', 'sigungu', 'dbizCd', 'dbizNm', 'fundRelated'];
  let fpSchemaErrors = 0;
  for (const fp of fundProjects.slice(0, 5)) {
    for (const field of fpRequired) {
      if (!(field in fp)) {
        fail(`fund-projects entry missing field "${field}"`);
        fpSchemaErrors++;
      }
    }
  }
  if (fpSchemaErrors === 0) ok('fund-projects schema spot-check passed');
}

// --- v1.5: insights.json ---
console.log('\n=== public/data/insights.json (v1.5) ===');
const insightsPath = join(PUBLIC_DATA_DIR, 'insights.json');
if (!existsSync(insightsPath)) {
  fail('public/data/insights.json missing');
} else {
  const insights = JSON.parse(readFileSync(insightsPath, 'utf-8'));
  if (!Array.isArray(insights.overExecution)) {
    fail('insights.overExecution is not an array');
  } else {
    const oe = insights.overExecution.length;
    ok(`overExecution count: ${oe}`);
    if (oe < 10 || oe > 40) {
      warn(`overExecution count ${oe} is outside expected range 10-40 (reference: ~21)`);
    } else {
      ok(`overExecution count in expected range (~21): ${oe}`);
    }
  }
  if (!Array.isArray(insights.underExecution)) {
    fail('insights.underExecution is not an array');
  } else {
    ok(`underExecution count: ${insights.underExecution.length}`);
  }
  if (!insights.stats || typeof insights.stats.totalProjects !== 'number') {
    fail('insights.stats.totalProjects missing or not a number');
  } else {
    ok(`stats.totalProjects: ${insights.stats.totalProjects}`);
  }
  if (!insights.stats || typeof insights.stats.clusteredNames !== 'number') {
    fail('insights.stats.clusteredNames missing or not a number');
  } else {
    ok(`stats.clusteredNames: ${insights.stats.clusteredNames}`);
  }
}

// --- v1.7: population-trend.json ---
console.log('\n=== public/data/population-trend.json (v1.7) ===');
const trendPath = join(PUBLIC_DATA_DIR, 'population-trend.json');
if (!existsSync(trendPath)) {
  warn('population-trend.json missing (run scripts/build-trend.mjs)');
} else {
  const trend = JSON.parse(readFileSync(trendPath, 'utf-8'));
  const nTrend = Object.keys(trend.series).length;
  nTrend === 107
    ? ok(`trend series: ${nTrend} regions x ${trend.months.length} months`)
    : fail(`trend series count: ${nTrend} (expected 107)`);
  const gaps = Object.values(trend.series).filter((arr) => arr.some((v) => v == null)).length;
  gaps === 0 ? ok('no missing months') : warn(`${gaps} regions with missing months`);
}

// --- v1.8: age-pyramid.json ---
console.log('\n=== public/data/age-pyramid.json (v1.8) ===');
const pyramidPath = join(PUBLIC_DATA_DIR, 'age-pyramid.json');
if (!existsSync(pyramidPath)) {
  warn('age-pyramid.json missing (run scripts/build-pyramid.mjs)');
} else {
  const pyr = JSON.parse(readFileSync(pyramidPath, 'utf-8'));
  const nPyr = Object.keys(pyr.series).length;
  nPyr === 107
    ? ok(`pyramid series: ${nPyr} regions (statsYm=${pyr.statsYm})`)
    : fail(`pyramid series count: ${nPyr} (expected 107)`);
  pyr.buckets.length === 11 ? ok('11 age buckets') : fail(`bucket count: ${pyr.buckets.length}`);
}

// --- v1.9: policy.json ---
console.log('\n=== public/data/policy.json (v1.9) ===');
const policyPath = join(PUBLIC_DATA_DIR, 'policy.json');
if (!existsSync(policyPath)) {
  warn('policy.json missing (run scripts/build-policy.mjs)');
} else {
  const pol = JSON.parse(readFileSync(policyPath, 'utf-8'));
  pol.regions.length === 107
    ? ok(`policy regions: ${pol.regions.length}`)
    : fail(`policy regions count: ${pol.regions.length} (expected 107)`);
  const ranks = new Set(pol.regions.map((r) => r.riskRank));
  ranks.size === 107 ? ok('riskRank unique 1..107') : fail('riskRank not unique');
  pol.fields.length > 0 ? ok(`field portfolio: ${pol.fields.length} fields`) : fail('fields empty');
}

// --- v2.0: vital-trend.json / lifepop.json ---
console.log('\n=== public/data/vital-trend.json & lifepop.json (v2.0) ===');
const vitalPath = join(PUBLIC_DATA_DIR, 'vital-trend.json');
if (!existsSync(vitalPath)) {
  warn('vital-trend.json missing (run scripts/build-vital.mjs — data.go.kr 활용신청 필요)');
} else {
  const vital = JSON.parse(readFileSync(vitalPath, 'utf-8'));
  const nV = Object.keys(vital.series).length;
  nV === 107 ? ok(`vital series: ${nV} regions x ${vital.months.length} months`) : fail(`vital series count: ${nV}`);
}
const lifepopPath = join(PUBLIC_DATA_DIR, 'lifepop.json');
if (!existsSync(lifepopPath)) {
  warn('lifepop.json missing (run scripts/parse_lifepop.py)');
} else {
  const lp = JSON.parse(readFileSync(lifepopPath, 'utf-8'));
  const nL = Object.keys(lp.series).length;
  nL === 107 ? ok(`lifepop series: ${nL} regions (${lp.quarter})`) : fail(`lifepop series count: ${nL}`);
}

// --- Final result ---
console.log('\n========== Validation Result ==========');
if (errors === 0) {
  console.log(`PASSED (${warnings} warnings)`);
} else {
  console.log(`FAILED: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}
