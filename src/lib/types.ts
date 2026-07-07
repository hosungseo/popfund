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

export type SortKey = "population" | "fund" | "agingIndex";
export type RegionType = "감소" | "관심" | "전체";
export type FundRelatedFilter = "confirmed" | "candidate" | "all";
