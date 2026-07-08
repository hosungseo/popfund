import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Region, Meta, Policy, Lifepop, VitalTrend, PopulationTrend, RegionMinutes, MinutesSummary } from "./types";

const PUBLIC_DATA = join(process.cwd(), "public", "data");
const FIXTURES = join(process.cwd(), "src", "lib", "fixtures");

function readJson<T>(publicPath: string, fixturePath: string): T {
  const target = existsSync(publicPath) ? publicPath : fixturePath;
  return JSON.parse(readFileSync(target, "utf-8")) as T;
}

export function loadRegions(): Region[] {
  return readJson<Region[]>(
    join(PUBLIC_DATA, "regions.json"),
    join(FIXTURES, "regions.json")
  );
}

export function loadMeta(): Meta {
  return readJson<Meta>(
    join(PUBLIC_DATA, "meta.json"),
    join(FIXTURES, "meta.json")
  );
}

export function loadRegionById(id: string): Region | undefined {
  const regions = loadRegions();
  return regions.find((r) => r.id === id);
}

export function loadPolicy(): Policy {
  return readJson<Policy>(
    join(PUBLIC_DATA, "policy.json"),
    join(FIXTURES, "policy.json")
  );
}

export function loadLifepop(): Lifepop | null {
  const p = join(PUBLIC_DATA, "lifepop.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as Lifepop;
  } catch {
    return null;
  }
}

export function loadVitalTrend(): VitalTrend | null {
  const p = join(PUBLIC_DATA, "vital-trend.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as VitalTrend;
  } catch {
    return null;
  }
}

export function loadPopulationTrend(): PopulationTrend | null {
  const p = join(PUBLIC_DATA, "population-trend.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as PopulationTrend;
  } catch {
    return null;
  }
}

/** Load all minutes JSON files and return a lightweight summary array (server-side only). */
export function loadMinutesSummary(): MinutesSummary[] {
  const dir = join(PUBLIC_DATA, "minutes");
  if (!existsSync(dir)) return [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const result: MinutesSummary[] = [];
    for (const file of files) {
      try {
        const raw = JSON.parse(
          readFileSync(join(dir, file), "utf-8")
        ) as RegionMinutes;
        result.push({
          regionId: raw.regionId,
          council: raw.council,
          totalCount: raw.totalCount,
          latestDate: raw.items[0]?.date ?? "",
        });
      } catch {
        // skip malformed files
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** Load a single region's minutes file (server-side only). Returns null if not found. */
export function loadRegionMinutes(regionId: string): RegionMinutes | null {
  const p = join(PUBLIC_DATA, "minutes", `${regionId}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as RegionMinutes;
  } catch {
    return null;
  }
}

/** Aggregate stats for summary cards */
export function loadSummaryStats(regions: Region[]) {
  const decreaseCount = regions.filter((r) => r.type === "감소").length;
  const interestCount = regions.filter((r) => r.type === "관심").length;
  const totalPopulation = regions.reduce(
    (acc, r) => acc + (r.population?.total ?? 0),
    0
  );

  const meta = loadMeta();
  const latestYear = meta.fundYears[meta.fundYears.length - 1];
  const totalFund = regions.reduce(
    (acc, r) => acc + (r.fund?.[latestYear] ?? 0),
    0
  );

  return { decreaseCount, interestCount, totalPopulation, totalFund, latestYear };
}
