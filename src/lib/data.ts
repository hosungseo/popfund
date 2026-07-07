import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Region, Meta } from "./types";

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
