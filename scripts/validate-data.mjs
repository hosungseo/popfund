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

// --- Final result ---
console.log('\n========== Validation Result ==========');
if (errors === 0) {
  console.log(`PASSED (${warnings} warnings)`);
} else {
  console.log(`FAILED: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}
