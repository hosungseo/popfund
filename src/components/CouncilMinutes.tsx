"use client";

import { useState, useEffect } from "react";
import type { RegionMinutes, MinuteItem } from "@/lib/types";
import { dataUrl } from "@/lib/utils";
import MinutesChatView from "./MinutesChatView";

interface Props {
  regionId: string;
}

function fmtDate(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function fmtUpdated(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

function ChatIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function MinuteCard({
  item,
  onChatOpen,
}: {
  item: MinuteItem;
  onChatOpen: (docid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col gap-2">
      {/* Meta row: date · generation/session · committee */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium text-stone-500 tabular-nums">
          {fmtDate(item.date)}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600">
          제{item.numpr}대 제{item.sesn}회
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 ring-1 ring-sky-200">
          {item.committee}
        </span>
      </div>

      {/* Subject body — line-clamp with expand toggle */}
      {item.subject && (
        <div>
          <p
            className={`text-sm text-stone-700 leading-relaxed ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {item.subject}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            {expanded ? "접기" : "더 보기"}
          </button>
        </div>
      )}

      {/* "대화 보기" button — only shown when subject exists (those are the top-10 with chat data) */}
      {item.subject && (
        <div className="pt-0.5">
          <button
            onClick={() => onChatOpen(item.docid)}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
            aria-label={`${fmtDate(item.date)} 회의록 대화 보기`}
          >
            <ChatIcon />
            대화 보기
          </button>
        </div>
      )}
    </div>
  );
}

export default function CouncilMinutes({ regionId }: Props) {
  const [data, setData] = useState<RegionMinutes | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChatDocid, setActiveChatDocid] = useState<string | null>(null);

  useEffect(() => {
    fetch(dataUrl(`/data/minutes/${regionId}.json`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RegionMinutes | null) => setData(d ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [regionId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <p className="text-sm text-stone-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-8 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500">
          준비 중
        </span>
        <p className="text-sm text-stone-500 max-w-sm">
          이 지역 의회의 회의록 데이터를 준비 중입니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header: council name + count badge + collected date */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-stone-700">
            {data.council}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
            『지방소멸대응기금』 언급 회의록 총{" "}
            {data.totalCount.toLocaleString("ko-KR")}건
          </span>
          <span className="text-xs text-stone-400">
            수집일 {fmtUpdated(data.updated)}
          </span>
        </div>

        {/* Item list (already newest-first from pipeline) */}
        {data.items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-8 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-stone-500">
              수집된 회의록 항목이 없습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.items.map((item) => (
              <MinuteCard
                key={item.docid}
                item={item}
                onChatOpen={setActiveChatDocid}
              />
            ))}
          </div>
        )}

        {/* Source caption */}
        <p className="text-[11px] text-stone-400 leading-relaxed">
          출처: 국회도서관 지방의정포털 (clik.nanet.go.kr). 회의록 원문은
          포털에서 의회·회기로 검색해 열람할 수 있습니다.
        </p>
      </div>

      {/* Chat drawer — rendered outside the flow to allow fixed positioning */}
      <MinutesChatView
        docid={activeChatDocid}
        regionId={regionId}
        onClose={() => setActiveChatDocid(null)}
      />
    </>
  );
}
