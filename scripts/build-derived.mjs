import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DATA_DIR = join(ROOT, 'public', 'data');
const PROJECTS_DIR = join(PUBLIC_DATA_DIR, 'projects');
const SIMILAR_DIR = join(PUBLIC_DATA_DIR, 'similar');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Exact implementations from data-contract.md
function normName(name) {
  return name.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
}

function shardOf(nm) {
  let h = 5381;
  for (let i = 0; i < nm.length; i++) {
    h = ((h * 33) ^ nm.charCodeAt(i)) >>> 0;
  }
  return (h & 0xff).toString(16).padStart(2, '0');
}

// Priority: confirmed(0) > candidate(1) > null(2) > excluded(3)
const FUND_PRIORITY = { confirmed: 0, candidate: 1, excluded: 3 };

function fundPriority(val) {
  return val === null ? 2 : (FUND_PRIORITY[val] ?? 2);
}

function bestFundRelated(a, b) {
  return fundPriority(a) <= fundPriority(b) ? a : b;
}

function main() {
  ensureDir(SIMILAR_DIR);

  // Load regions for lafCd join
  const regions = JSON.parse(readFileSync(join(PUBLIC_DATA_DIR, 'regions.json'), 'utf-8'));
  const regionByLafCd = new Map(regions.map((r) => [r.lafCd, r]));
  console.log(`Loaded ${regions.length} regions`);

  // Load all 107 project files
  const projectFiles = readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Found ${projectFiles.length} project files`);

  // clusterMap: normName → Map<lafCd, ClusterEntry>
  const clusterMap = new Map();
  const fundProjects = [];
  const overExecution = [];
  let totalProjects = 0;

  for (const file of projectFiles) {
    const data = JSON.parse(readFileSync(join(PROJECTS_DIR, file), 'utf-8'));
    const { lafCd, projects } = data;
    const region = regionByLafCd.get(lafCd);
    if (!region) {
      console.warn(`  [WARN] No region for lafCd=${lafCd}`);
      continue;
    }

    totalProjects += projects.length;

    for (const project of projects) {
      const nn = normName(project.dbizNm);

      // --- Similar cluster accumulation ---
      if (!clusterMap.has(nn)) clusterMap.set(nn, new Map());
      const lafMap = clusterMap.get(nn);
      if (!lafMap.has(lafCd)) {
        lafMap.set(lafCd, {
          lafCd,
          dbizNm: project.dbizNm,
          acntDvNm: project.acntDvNm,
          bdgCashAmt: 0,
          epAmt: 0,
          fundRelated: null,
        });
      }
      const entry = lafMap.get(lafCd);
      entry.bdgCashAmt += project.bdgCashAmt;
      entry.epAmt += project.epAmt;
      entry.fundRelated = bestFundRelated(entry.fundRelated, project.fundRelated);

      // --- Fund projects ---
      if (project.fundRelated === 'confirmed' || project.fundRelated === 'candidate') {
        fundProjects.push({
          ...project,
          regionId: region.id,
          lafCd,
          sido: region.sido,
          sigungu: region.sigungu,
        });
      }

      // --- Over-execution: all nationwide, bdgCashAmt > 0 && epAmt > bdgCashAmt ---
      if (project.bdgCashAmt > 0 && project.epAmt > project.bdgCashAmt) {
        const rate = (project.epAmt / project.bdgCashAmt) * 100;
        overExecution.push({
          ...project,
          regionId: region.id,
          lafCd,
          sido: region.sido,
          sigungu: region.sigungu,
          rate,
        });
      }
    }
  }

  console.log(`Total projects: ${totalProjects}`);

  // --- Build & write 256 similar shards ---
  console.log('\nBuilding similar shards...');
  const shards = {};
  for (let i = 0; i < 256; i++) {
    shards[i.toString(16).padStart(2, '0')] = {};
  }

  let clusteredNames = 0;
  for (const [nn, lafMap] of clusterMap) {
    if (lafMap.size < 2) continue;
    clusteredNames++;
    const shard = shardOf(nn);
    shards[shard][nn] = [...lafMap.values()];
  }

  let totalShardKeys = 0;
  const shardSizes = [];
  for (const [hex, data] of Object.entries(shards)) {
    const keyCount = Object.keys(data).length;
    totalShardKeys += keyCount;
    shardSizes.push(keyCount);
    writeFileSync(join(SIMILAR_DIR, `${hex}.json`), JSON.stringify(data), 'utf-8');
  }

  const maxShard = Math.max(...shardSizes);
  const avgShard = totalShardKeys / shardSizes.length;
  console.log(`Written 256 shards, total keys: ${totalShardKeys}, max: ${maxShard}, avg: ${avgShard.toFixed(1)}`);
  console.log(`Multi-region clusters: ${clusteredNames}`);

  // --- Write fund-projects.json ---
  writeFileSync(
    join(PUBLIC_DATA_DIR, 'fund-projects.json'),
    JSON.stringify(fundProjects, null, 2),
    'utf-8',
  );
  console.log(`\nWritten fund-projects.json (${fundProjects.length} entries)`);

  // --- Build under-execution ---
  const underExecution = [];
  for (const fp of fundProjects) {
    if (fp.bdgCashAmt >= 100_000_000) {
      const rate = (fp.epAmt / fp.bdgCashAmt) * 100;
      if (rate < 30) {
        underExecution.push({ ...fp, rate });
      }
    }
  }

  overExecution.sort((a, b) => b.rate - a.rate);
  underExecution.sort((a, b) => a.rate - b.rate);

  // --- Write insights.json ---
  const insights = {
    overExecution,
    underExecution,
    stats: { totalProjects, clusteredNames },
  };
  writeFileSync(join(PUBLIC_DATA_DIR, 'insights.json'), JSON.stringify(insights, null, 2), 'utf-8');
  console.log(`Written insights.json (over=${overExecution.length}, under=${underExecution.length})`);

  // --- Final summary ---
  console.log('\n========== Build Derived Summary ==========');
  console.log(`Total projects:          ${totalProjects}`);
  console.log(`Clustered names:         ${clusteredNames}`);
  console.log(`Fund projects:           ${fundProjects.length}`);
  console.log(`Over-execution entries:  ${overExecution.length}`);
  console.log(`Under-execution entries: ${underExecution.length}`);
  console.log(`Shard max/avg keys:      ${maxShard} / ${avgShard.toFixed(1)}`);
}

main();
