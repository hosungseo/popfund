# 지방소멸대응기금 워치

**Live: https://hosungseo.github.io/popfund/** (GitHub Pages — main 푸시 시 자동 배포)

행정안전부 지정 **인구감소지역 89곳 + 관심지역 18곳**의 인구 현황과 **지방소멸대응기금** 예산·사업 집행을 한눈에 보는 대시보드.

- `/` 전국 개요 — 107개 지역 인구·기금·1인당 기금 테이블 (시도/유형 필터, 정렬)
- `/compare` 지역 비교 — 최대 6개 지역 인구 지표 + 연도별 기금 예산 추이
- `/region/[id]` 지역 상세 — 인구 지표, 연도별 기금 예산, 세부사업 집행 현황(검색·정렬·페이지네이션).
  사업 행 클릭 → **다른 지역 동일 사업 비교 드로어** (사업명 정규화 + 256 샤드 인덱스)
- `/projects` 기금사업 탐색 — 전국 기금 확정·후보 사업 모아보기 (초과·저조집행 신호)
- `/insights` 인사이트 — 1인당 기금 랭킹, 초과집행 사업, 인구×기금 산점도
- 지방의회 회의록 연계(국회도서관 지방의정포털)는 v2 예정

파생 데이터 재생성: `npm run data:derived` (projects/*.json 기반, API 호출 없음)

## 데이터 원천

| 데이터 | 출처 | 방식 |
|---|---|---|
| 지역 지정 목록 | 행정안전부 인구감소지역 고시 | 정적 (`data/regions.json`) |
| 인구 지표 (2024) | 통계청 인구총조사 CSV | 빌드타임 파싱 |
| 기금 예산 (2024~2026) | 지방재정365 GJSCS `lcl_dspr_cntrm_fnd_amt` | OpenAPI |
| 세부사업 집행 | 지방재정365 QWGJK (일자별 스냅샷) | OpenAPI |

주의: GJSCS의 기금 재원 컬럼은 **2024 회계연도부터** 반영됨 (2022~2023은 원천 데이터에 미반영). 일부 지자체는 회계처리 방식에 따라 기금액이 0으로 표시될 수 있음.

## 실행

```bash
cp .env.example .env.local   # LOFIN_API_KEY 입력
npm install
npm run data:build           # OpenAPI + CSV → public/data/*.json (원시 캐시: data/raw/)
npm run dev
```

스키마 계약: `docs/data-contract.md` · 검증: `node scripts/validate-data.mjs`

주의: `output: "export"`(정적 export) 설정이라 `npm run start`는 동작하지 않는다.
로컬 확인은 `npm run dev`, 배포 산출물 확인은 `npm run build && npx serve out`.

## 기금사업 확정 매핑

QWGJK에는 재원 구분이 없어 세부사업이 기금사업인지 API만으로 알 수 없다.
`data/project_map.csv`(`dbiz_cd,status,note`, status=confirmed|excluded)에 확정 자료를 넣고
`npm run data:build`를 다시 실행하면 반영된다. 매핑 전에는 사업명 키워드(지방소멸/소멸대응/인구감소) 기반 "후보"로 표시.

## 스냅샷 갱신

QWGJK 지출액은 조회일 기준 스냅샷. `scripts/build-data.mjs`의 `EXE_YMD`를 바꾸고
`data/raw/qwgjk/`를 비운 뒤 `npm run data:build` 재실행.
