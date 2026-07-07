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

## 회의록 연계 (v2 슬롯)
향후 국회도서관 지방의정포털 회의록 연계 예정. Region.id 기준으로 `public/data/minutes/{id}.json`을 추가하는 구조를 가정만 하고 v1에서는 구현하지 않음. UI에는 "지방의회 논의" 탭 자리(준비 중)만 둔다.
