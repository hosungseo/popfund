export interface Population {
  total: number;
  male: number;
  female: number;
  density: number | null;
  avgAge: number | null;
  agingIndex: number | null;
  youthDependency: number | null;
  oldAgeDependency: number | null;
}

export interface Region {
  id: string;
  sido: string;
  sigungu: string;
  type: "감소" | "관심";
  lafCd: string;
  censusCode: string;
  population: Population;
  fund: Record<string, number>;
}

export interface Project {
  dbizCd: string;
  dbizNm: string;
  acntDvNm: string;
  fldNm: string;
  partNm: string;
  bdgCashAmt: number;
  bdgNtep: number;
  capep: number;
  sggep: number;
  etcAmt: number;
  epAmt: number;
  cplAmt: number;
  fundRelated: "confirmed" | "excluded" | "candidate" | null;
}

export interface RegionProjects {
  lafCd: string;
  exeYmd: string;
  projects: Project[];
}

export interface Meta {
  builtAt: string;
  exeYmd: string;
  fundYears: string[];
  censusYear: string;
  sources: string[];
}

export type SortKey = "population" | "fund" | "agingIndex" | "perCapitaFund";
export type RegionType = "감소" | "관심" | "전체";
export type FundRelatedFilter = "confirmed" | "candidate" | "all";

// v1.8 types
export interface AgePyramid {
  statsYm: string;
  buckets: string[];
  series: Record<string, { male: number[]; female: number[] }>;
}

// v1.7 types
export interface PopulationTrend {
  designatedYm: string;
  firstYm: string;
  months: string[];
  series: Record<string, (number | null)[]>;
}

// v1.5 types

export interface FundProject extends Project {
  regionId: string;
  lafCd: string;
  sido: string;
  sigungu: string;
}

export interface ClusterEntry {
  lafCd: string;
  dbizNm: string;
  acntDvNm: string;
  bdgCashAmt: number;
  epAmt: number;
  fundRelated: "confirmed" | "excluded" | "candidate" | null;
}

export interface Insights {
  overExecution: (FundProject & { rate: number })[];
  underExecution: (FundProject & { rate: number })[];
  stats: { totalProjects: number; clusteredNames: number };
}

// v1.9 types
export interface PolicyBasis {
  trendRange: [string, string];
  fundYears: string[];
  pyramidYm: string;
}

export interface PolicyRegion {
  id: string;
  sido: string;
  sigungu: string;
  type: "감소" | "관심";
  latestPop: number;
  declinePct: number;
  perCapitaFundCum: number;
  fundExecRate: number | null;
  fundProjectCount: number;
  elderlyPct: number;
  youthPct: number;
  riskScore: number;
  riskRank: number;
}

export interface FieldPortfolio {
  fldNm: string;
  totalBdg: number;
  totalEp: number;
  count: number;
  execRate: number;
}

export interface Policy {
  basis: PolicyBasis;
  regions: PolicyRegion[];
  fields: FieldPortfolio[];
  medians: { perCapitaFundCum: number; declinePct: number };
}
