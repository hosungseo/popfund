#!/usr/bin/env python3
"""행안부 생활인구 분기 공표 xlsx → public/data/lifepop.json

입력: ~/popfund-data/lifepop/q4_2025_sn1.xlsx (인구감소지역 고시1 통계표)
      ~/popfund-data/lifepop/q4_2025_sn4.xlsx (인구감소관심지역, 고시1 통계표 시트)
행 구조: 기준연월 | 시도명 | 시군구명 | (구분) | 생활인구구분(계/주민등록인구/체류인구/...) | 계 | 남 | 여 | ...
"""
import json
import os
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.expanduser("~/popfund-data/lifepop")
OUT = os.path.join(ROOT, "public", "data", "lifepop.json")

SIDO_SHORT = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주",
}

regions = json.load(open(os.path.join(ROOT, "data", "regions.json")))
name_to_id = {(r["sido"], r["sigungu"]): r["id"] for r in regions}

def parse_sheet(path, sheet):
    df = pd.read_excel(path, sheet_name=sheet, header=None)
    # locate column indices from the two header rows
    head = df.iloc[0].tolist()
    ym_col, sido_col, sgg_col = 0, 1, 2
    # 생활인구 구분 컬럼: '생활인구' 라벨이 있는 열 (관심지역 파일은 '구분' 열이 하나 더 있음)
    kind_col = next(i for i, v in enumerate(head) if str(v).strip() == "생활인구")
    total_col = kind_col + 1  # '계'(성별 계) 열
    out = []
    for _, row in df.iloc[2:].iterrows():
        ym = str(row[ym_col]).strip()
        if not ym.isdigit():
            continue
        sido = SIDO_SHORT.get(str(row[sido_col]).strip())
        sgg = str(row[sgg_col]).strip()
        kind = str(row[kind_col]).strip()
        val = row[total_col]
        if sido and kind and pd.notna(val):
            out.append((ym, sido, sgg, kind, int(val)))
    return out

rows = []
rows += parse_sheet(os.path.join(SRC, "q4_2025_sn1.xlsx"), "고시1 통계표")
rows += parse_sheet(os.path.join(SRC, "q4_2025_sn4.xlsx"), "고시1 통계표")

# series[regionId][ym] = {living, registered, staying}
KIND_KEY = {"계": "living", "주민등록인구": "registered", "체류인구": "staying"}
series = {}
months = sorted({ym for ym, *_ in rows})
unmatched = set()
for ym, sido, sgg, kind, val in rows:
    key = KIND_KEY.get(kind)
    if not key:
        continue
    rid = name_to_id.get((sido, sgg))
    if not rid:
        unmatched.add(f"{sido}-{sgg}")
        continue
    series.setdefault(rid, {}).setdefault(ym, {})[key] = val

# compact: 분기 평균 배율 + 월별 값
out_series = {}
for rid, byym in series.items():
    ratios = []
    monthly = {}
    for ym, v in byym.items():
        if v.get("registered") and v.get("staying") is not None:
            ratios.append(v["staying"] / v["registered"])
        monthly[ym] = v
    out_series[rid] = {
        "monthly": monthly,
        "stayRatio": round(sum(ratios) / len(ratios), 2) if ratios else None,
    }

out = {
    "quarter": "2025Q4",
    "months": months,
    "source": "행정안전부 인구감소지역 생활인구 산정 결과 공표 (2025년 4분기)",
    "series": out_series,
}
json.dump(out, open(OUT, "w"), ensure_ascii=False)

print(f"saved {OUT} — {len(out_series)} regions, months={months}")
print("unmatched:", sorted(unmatched) or "none")
missing = [r["id"] for r in regions if r["id"] not in out_series]
print("regions without lifepop:", missing or "none")
top = sorted(out_series.items(), key=lambda kv: -(kv[1]["stayRatio"] or 0))[:5]
print("체류 배율 top5:", [(k, v["stayRatio"]) for k, v in top])
