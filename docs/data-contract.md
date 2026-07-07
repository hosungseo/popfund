# popfund 데이터 계약 (v1)

파이프라인(scripts/)과 UI(src/)가 공유하는 산출물 스키마. 이 문서가 단일 진실 원천이다.

## 산출 파일 (public/data/)

### 1. `public/data/regions.json`
107개 지역 마스터. 배열.

```ts
interface Region {
  id: string;          // "강원-홍천군" (sido-sigungu)
  sido: string;        // 짧은 시도명: 서울/부산/…/제주
  sigungu: string;     // "홍천군"
  type: "감소" | "관심"; // 인구감소지역 89 / 관심지역 18
  lafCd: string;       // 지방재정365 자치단체코드 e.g. "4272000"
  censusCode: string;  // 통계청 시도(2)+시군구(3) 5자리 e.g. "32050"
  population: {
    total: number;         // 총인구 (2024 인구총조사)
    male: number;
    female: number;
    density: number | null;       // 인구밀도(명/km²)
    avgAge: number | null;        // 평균나이
    agingIndex: number | null;    // 노령화지수
    youthDependency: number | null; // 유년부양비
    oldAgeDependency: number | null; // 노년부양비
  };
  fund: Record<string, number>; // 회계연도 → 지방소멸대응기금 세출예산액(원)
                                 // GJSCS lcl_dspr_cntrm_fnd_amt 를 분야 합산
                                 // 2024~2026만 제공 (해당 컬럼이 2024 회계연도부터 반영,
                                 // 2022-2023은 원천 데이터에 전 지자체 0 = 미반영)
                                 // e.g. {"2024": 12000000000, ..., "2026": ...}
}
```

### 2. `public/data/projects/{lafCd}.json`
지역별 세부사업 세출현황 스냅샷 (QWGJK).

```ts
interface RegionProjects {
  lafCd: string;
  exeYmd: string;       // 스냅샷 집행일자 "20260705"
  projects: Project[];
}
interface Project {
  dbizCd: string;       // 세부사업코드
  dbizNm: string;       // 세부사업명
  acntDvNm: string;     // 회계구분명
  fldNm: string;        // 분야명
  partNm: string;       // 부문명
  bdgCashAmt: number;   // 예산현액(원)
  bdgNtep: number;      // 국비
  capep: number;        // 시도비
  sggep: number;        // 시군구비
  etcAmt: number;       // 기타
  epAmt: number;        // 지출액
  cplAmt: number;       // 자금배정액(편성액)
  fundRelated: "confirmed" | "excluded" | "candidate" | null;
  // confirmed/excluded: data/project_map.csv 기반 (사용자 제공 자료로 추후 확정)
  // candidate: 사업명 휴리스틱(지방소멸/소멸대응/기금 등 키워드) 매칭
  // null: 미분류
}
```

### 3. `public/data/meta.json`
```ts
interface Meta {
  builtAt: string;      // ISO
  exeYmd: string;       // QWGJK 스냅샷 일자
  fundYears: string[];  // ["2022","2023","2024","2025","2026"]
  censusYear: string;   // "2024"
  sources: string[];    // 출처 설명 문자열
}
```

## 입력

- `data/regions.json` — id/sido/sigungu/type/lafCd/censusCode 까지 채워진 마스터(이미 존재). 파이프라인이 population/fund를 채워 public/data/regions.json 생성.
- `~/popfund-data/_census_reqdoc_1783398005042/*.csv` — 2024 인구총조사. 컬럼: 연도,행정구역코드,지표코드,값 (헤더 없음). 행정구역코드 5자리 = censusCode. 지표코드 의미는 `~/popfund-data/ref_code/ref_code/3. 제공용 코드(statistics_code).xls` 참조 (예: to_in_001=총인구). 파일명이 지표를 나타냄.
- 지방재정365 OpenAPI (Key는 `.env.local`의 `LOFIN_API_KEY`):
  - GJSCS 기능별 재원별 세출예산: `https://www.lofin365.go.kr/lf/hub/GJSCS?Key=…&Type=json&pIndex=1&pSize=1000&fyr=2026` — 페이지네이션, `lcl_dspr_cntrm_fnd_amt` 합산
  - QWGJK 세부사업별 세출현황: 필수 `fyr`,`exe_ymd`, 선택 `laf_cd` — 107개 lafCd별 조회
  - 응답 형식: `{"GJSCS":[{"head":[{"list_total_count":N},{"RESULT":{"CODE":"INFO-000"}}]},{"row":[...]}]}`
  - 오류코드 337 = 일일 트래픽 초과. 호출 간 200ms 지연, 실패 시 3회 재시도.
- `data/project_map.csv` — `dbiz_cd,status,note` (status: confirmed|excluded). 없으면 빈 것으로 처리.

## 경로 소유권 (충돌 방지)
- 파이프라인 에이전트: `scripts/`, `data/`, `public/data/`
- UI 에이전트: `src/`
- 공유: 이 문서(읽기 전용)

## v1.5 산출물 (유사사업·탐색·인사이트)

### 4. `public/data/similar/{shard}.json` — 유사사업 클러스터 인덱스 (256 샤드)
지역 간 사업명이 겹치는(2개 지역 이상) 클러스터만 수록. 샤드 = normName 해시 하위 1바이트 hex 2자리(`00`~`ff`).

```ts
// 파일 내용: Record<normName, ClusterEntry[]>
interface ClusterEntry {
  lafCd: string;
  dbizNm: string;       // 원본 사업명 (대표 1개)
  acntDvNm: string;
  bdgCashAmt: number;
  epAmt: number;
  fundRelated: "confirmed" | "excluded" | "candidate" | null;
}
```

**정규화·해시 규칙 (파이프라인과 UI가 반드시 동일 구현):**
```js
function normName(name) {
  return name.replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
}
function shardOf(normName) {
  let h = 5381;
  for (let i = 0; i < normName.length; i++) {
    h = ((h * 33) ^ normName.charCodeAt(i)) >>> 0;
  }
  return (h & 0xff).toString(16).padStart(2, "0");
}
```
클러스터에 없는 사업명(단일 지역)은 샤드에 키가 없음 → UI는 "다른 지역 동일 사업 없음" 표시.
동일 지역 내 같은 normName 여러 건(회계 구분 등)은 금액 합산해 지역당 1개 엔트리로 축약.

### 5. `public/data/fund-projects.json` — 전국 기금사업 모음
fundRelated가 confirmed 또는 candidate인 사업 전체 (현재 493건).

```ts
interface FundProject extends Project {
  regionId: string;     // "강원-홍천군"
  lafCd: string;
  sido: string;
  sigungu: string;
}
// 파일 내용: FundProject[]
```

### 6. `public/data/insights.json`
```ts
interface Insights {
  overExecution: (FundProject 동일 필드 + { rate: number })[];
    // 전국 bdgCashAmt>0 && epAmt>bdgCashAmt 사업 전부, rate 내림차순
  underExecution: (FundProject 동일 필드 + { rate: number })[];
    // 기금(confirmed|candidate) 사업 중 bdgCashAmt >= 1억 && rate < 30% , rate 오름차순
  stats: { totalProjects: number; clusteredNames: number; };
}
```
1인당 기금액은 regions.json(population.total, fund)에서 UI가 직접 계산 — 별도 산출물 없음.

## v1.6 산출물 (지도)

### 7. `public/data/korea-sigungu.json` — 전국 시군구 경계 GeoJSON (생성 완료)
전국 251개 시군구 폴리곤 (southkorea-maps KOSTAT 2013 simplified, 366KB).

```ts
// FeatureCollection. 각 feature.properties:
interface SigunguProps {
  code: string;      // 2013 KOSTAT 코드 (현행 censusCode와 다름 — 조인에 쓰지 말 것)
  name: string;      // "홍천군"
  sido: string;      // 짧은 시도명 ("강원")
  regionId?: string; // 107개 지정 지역이면 Region.id ("강원-홍천군"), 아니면 없음
}
```
regionId로 regions.json과 조인. regionId 없는 폴리곤 = 비지정 지역 (연한 회색 배경 처리).
주의: 군위군 폴리곤은 2013 당시 경북 위치 그대로이나 regionId="대구-군위군"로 이미 매핑됨.

## v1.7 산출물 (인구 추이)

### 8. `public/data/population-trend.json` — 월별 주민등록인구 추이
출처: 행안부 주민등록 인구 및 세대현황 OpenAPI (매월 말일 집계, 거주자+거주불명자+재외국민).
**주의: 원천 API가 2022-10부터만 제공.** 인구감소지역 최초 지정은 2021-10 (고시) — 지정 직후 1년은 데이터 없음. UI는 이를 명시할 것 ("데이터 없음"이지 "변화 없음"이 아님).

```ts
interface PopulationTrend {
  designatedYm: "202110"; // 최초 지정 고시 연월
  firstYm: "202210";      // 원천 제공 시작 연월
  months: string[];       // ["202210", "202211", ..., 최신 완결월]
  series: Record<string, (number | null)[]>; // regionId → months와 정렬된 총인구 배열
}
```
값은 주민등록 총인구수(totNmprCnt). regions.json의 population(2024 인구총조사)과 출처가 다르므로
같은 화면에서 혼용 시 출처 라벨을 구분할 것.

## v1.8 산출물 (인구 피라미드)

### 9. `public/data/age-pyramid.json` — 성·연령별 주민등록 인구 (최신월)
출처: 행안부 행정동별 성/연령별 주민등록 인구수 OpenAPI. 10세 단위 11개 버킷.

```ts
interface AgePyramid {
  statsYm: string;    // "202506" 등 최신 완결월
  buckets: string[];  // ["0-9","10-19",...,"90-99","100+"] 11개
  series: Record<string, { male: number[]; female: number[] }>; // regionId → 버킷 정렬 배열
}
```

## v1.9 산출물 (정책 시사점)

### 10. `public/data/policy.json` — 정책 분석 지표 (기존 산출물에서 파생, API 호출 없음)

```ts
interface Policy {
  basis: {
    trendRange: [string, string]; // ["202210","202606"] 감소율 계산 구간
    fundYears: string[];          // 누계 기금 연도
    pyramidYm: string;
  };
  regions: PolicyRegion[];        // 107개
  fields: FieldPortfolio[];       // 분야별 기금사업 집계
  medians: { perCapitaFundCum: number; declinePct: number };
}
interface PolicyRegion {
  id: string; sido: string; sigungu: string; type: "감소" | "관심";
  latestPop: number;            // 추이 최신월 주민등록 인구
  declinePct: number;           // (최신-최초)/최초*100, 음수=감소
  perCapitaFundCum: number;     // 누계 기금(2024-26) ÷ latestPop (원/인)
  fundExecRate: number | null;  // 기금(confirmed|candidate) 사업 가중평균 집행률 % (Σep/Σbdg), 사업 없으면 null
  fundProjectCount: number;
  elderlyPct: number;           // 60세+ 비율 %
  youthPct: number;             // 0-19세 비율 %
  riskScore: number;            // z(-declinePct)+z(elderlyPct)+z(-youthPct) 평균, 높을수록 위기
  riskRank: number;             // 1 = 최고 위기
}
interface FieldPortfolio {
  fldNm: string;
  totalBdg: number; totalEp: number; count: number;
  execRate: number;             // Σep/Σbdg %
}
```

해석 원칙: 상관≠인과. 기금-인구 산점도는 "효과 평가"가 아니라 배분·성과 관찰용임을 UI에 명시.

## v2.0 예정 산출물 (자연증감 — 활용신청 대기)

### 11. `public/data/vital-trend.json` — 월별 출생·사망 (scripts/build-vital.mjs 준비 완료)
data.go.kr **활용신청 필요** (자동승인): 출생등록자수 15108075(admmSexdBrthReg), 사망말소자수 15108077(admmSexdAgeErsr).
신청 완료 후 `npm run data:vital` 실행하면 생성.

```ts
interface VitalTrend {
  firstYm: "202210";
  months: string[];
  series: Record<string, { births: (number|null)[]; deaths: (number|null)[] }>;
}
```
자연증감 = births - deaths. population-trend의 월간 증감에서 자연증감을 빼면 사회적 증감(순이동) 근사 가능
→ "인구 감소가 자연감소 때문인지 유출 때문인지" 분해가 핵심 정책 시사점.

별도: 행정안전부_생활인구(15130539, FILE·분기)는 인구감소지역 89곳 공식 생활인구(체류인구).
신청 후 CSV를 data/raw/에 넣고 파싱 스크립트 추가 예정 — "등록인구 대비 체류 배율" 지표.

## 회의록 연계 (v2 슬롯)
향후 국회도서관 지방의정포털 회의록 연계 예정. Region.id 기준으로 `public/data/minutes/{id}.json`을 추가하는 구조를 가정만 하고 v1에서는 구현하지 않음. UI에는 "지방의회 논의" 탭 자리(준비 중)만 둔다.
