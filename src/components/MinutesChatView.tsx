"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { MinutesChat, Utterance, Councilors, CouncilorProfile } from "@/lib/types";
import { dataUrl } from "@/lib/utils";

interface Props {
  docid: string | null;
  regionId: string;
  onClose: () => void;
}

function fmtDate(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function highlightKeyword(text: string, keyword: string): ReactNode {
  if (!keyword) return text;
  const parts = text.split(keyword);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="bg-amber-200 text-amber-900 rounded-sm px-0.5 not-italic font-semibold">
              {keyword}
            </mark>
          )}
        </span>
      ))}
    </>
  );
}

function SpeakerChip({
  speaker,
  role,
  profile,
  isCouncilor,
}: {
  speaker: string;
  role: string;
  profile: CouncilorProfile | null;
  isCouncilor: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        className={[
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors",
          isCouncilor
            ? "bg-stone-100 text-stone-700 hover:bg-stone-200"
            : "bg-stone-200/70 text-stone-600 hover:bg-stone-300/70",
        ].join(" ")}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${speaker} 프로필`}
        aria-expanded={open}
      >
        {role && (
          <span className="text-stone-400 font-normal">{role}</span>
        )}
        <span>{speaker}</span>
      </button>

      {open && (
        <div
          className={[
            "absolute bottom-full mb-2 z-30 w-52 rounded-xl bg-white shadow-xl border border-stone-200 px-3 py-2.5 text-xs",
            isCouncilor ? "left-0" : "right-0",
          ].join(" ")}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {profile ? (
            <dl className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <dt className="text-stone-400 shrink-0 w-14">이름</dt>
                <dd className="text-stone-800 font-semibold">{profile.name}</dd>
              </div>
              {profile.party && (
                <div className="flex items-start gap-2">
                  <dt className="text-stone-400 shrink-0 w-14">정당</dt>
                  <dd className="text-stone-700">{profile.party}</dd>
                </div>
              )}
              {profile.district && (
                <div className="flex items-start gap-2">
                  <dt className="text-stone-400 shrink-0 w-14">선거구</dt>
                  <dd className="text-stone-700">{profile.district}</dd>
                </div>
              )}
              {profile.position && (
                <div className="flex items-start gap-2">
                  <dt className="text-stone-400 shrink-0 w-14">직위</dt>
                  <dd className="text-stone-700">{profile.position}</dd>
                </div>
              )}
              {profile.committees && (
                <div className="flex items-start gap-2">
                  <dt className="text-stone-400 shrink-0 w-14">위원회</dt>
                  <dd className="text-stone-700">{profile.committees}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-stone-500">집행부 또는 외부 인사</p>
          )}
        </div>
      )}
    </div>
  );
}

function GapDivider() {
  return (
    <div
      className="flex items-center gap-3 py-2 px-2"
      role="separator"
      aria-label="중략 구간"
    >
      <div className="flex-1 border-t border-dashed border-stone-300" />
      <span className="text-[11px] text-stone-400 font-medium tracking-wide shrink-0">
        ···중략···
      </span>
      <div className="flex-1 border-t border-dashed border-stone-300" />
    </div>
  );
}

function BubbleRow({
  utterance,
  byName,
  keyword,
}: {
  utterance: Utterance;
  byName: Record<string, CouncilorProfile>;
  keyword: string;
}) {
  const profile = byName[utterance.speaker] ?? null;
  // 프로필 매칭 + 발언 직위 기반 폴백: 의원정보 데이터가 없거나 미수록 의원이어도
  // 위원/의장 등 의정 직위면 의원측(좌측)으로 분류한다.
  const isCouncilor =
    !!profile || /^(위원장|부위원장|위원|의장|부의장|의원)$/.test(utterance.role);
  // Councilors on the left, exec/others on the right
  const isLeft = isCouncilor;

  return (
    <div
      className={`flex flex-col gap-1 ${isLeft ? "items-start" : "items-end"}`}
    >
      <SpeakerChip
        speaker={utterance.speaker}
        role={utterance.role}
        profile={profile}
        isCouncilor={isCouncilor}
      />
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border",
          isLeft
            ? utterance.hit
              ? "bg-white border-rose-300 shadow-sm shadow-rose-100 rounded-tl-sm"
              : "bg-white border-stone-200 rounded-tl-sm"
            : utterance.hit
            ? "bg-rose-50 border-rose-200 rounded-tr-sm"
            : "bg-stone-100 border-stone-200 rounded-tr-sm",
          "text-stone-800",
        ].join(" ")}
      >
        {utterance.hit
          ? highlightKeyword(utterance.text, keyword)
          : utterance.text}
      </div>
    </div>
  );
}

export default function MinutesChatView({ docid, regionId, onClose }: Props) {
  const [chat, setChat] = useState<MinutesChat | null>(null);
  const [councilors, setCouncilors] = useState<Councilors | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!docid) {
      setChat(null);
      setCouncilors(null);
      setNotFound(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    let cancelled = false;

    Promise.all([
      fetch(dataUrl(`/data/minutes-chat/${docid}.json`)).then((r) =>
        r.ok ? (r.json() as Promise<MinutesChat>) : null
      ),
      fetch(dataUrl(`/data/councilors/${regionId}.json`)).then((r) =>
        r.ok ? (r.json() as Promise<Councilors>) : null
      ),
    ])
      .then(([chatData, councilorData]) => {
        if (cancelled) return;
        if (!chatData) {
          setNotFound(true);
          setChat(null);
        } else {
          setChat(chatData);
        }
        setCouncilors(councilorData);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setChat(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docid, regionId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!docid) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [docid, handleKeyDown]);

  const isOpen = !!docid;
  const byName = councilors?.byName ?? {};

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer — bottom sheet (mobile) / right slide (desktop) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="회의록 대화 보기"
        className={[
          "fixed z-50 bg-stone-50 shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-out",
          // Mobile: bottom sheet, full width
          "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl",
          // Desktop: right panel, full height
          "md:inset-y-0 md:left-auto md:right-0 md:w-[520px] md:max-h-none md:h-full md:rounded-none md:border-l md:border-stone-200",
          // Slide animations
          isOpen
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-x-full md:translate-y-0",
        ].join(" ")}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-stone-300" />
        </div>

        {docid && (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-stone-200 px-5 py-4 flex items-start gap-3 bg-white">
              <div className="flex-1 min-w-0">
                {chat ? (
                  <>
                    <p className="text-xs text-stone-500 mb-1 font-medium truncate">
                      {chat.council}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-stone-800 tabular-nums">
                        {fmtDate(chat.date)}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 ring-1 ring-sky-200">
                        {chat.committee}
                      </span>
                    </div>
                  </>
                ) : loading ? (
                  <p className="text-sm text-stone-400">불러오는 중...</p>
                ) : (
                  <p className="text-sm font-medium text-stone-600">회의록 대화 보기</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="닫기"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin" />
                  <p className="text-sm text-stone-400">대화 데이터를 불러오는 중...</p>
                </div>
              ) : notFound || !chat ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-stone-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-600 mb-1">
                      이 회의의 대화 데이터를 준비 중입니다.
                    </p>
                    <p className="text-xs text-stone-400">
                      수집 완료 후 자동으로 반영됩니다.
                    </p>
                  </div>
                </div>
              ) : chat.utterances.length === 0 ? (
                // 검색은 형태소·첨부 단위로 매칭되어 회의록 본문에는 키워드가 없을 수 있음
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <p className="text-sm font-medium text-stone-600">
                    본문에서 『{chat.keyword}』 직접 발언을 찾지 못했습니다.
                  </p>
                  <p className="text-xs text-stone-400 max-w-xs">
                    이 회의는 첨부 자료나 유사 표현으로 검색에 포함된 경우입니다.
                    안건 요지는 목록에서 확인할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Legend banner */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 mb-1">
                    <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-rose-400" aria-hidden="true" />
                    <p className="text-xs text-amber-700">
                      <mark className="bg-amber-200 text-amber-900 rounded-sm px-0.5 font-semibold">
                        {chat.keyword}
                      </mark>{" "}
                      포함 발언은 rose 테두리로 강조됩니다.
                    </p>
                  </div>

                  {/* Utterance bubbles */}
                  {chat.utterances.map((u: Utterance, i: number) => (
                    <div key={i}>
                      {u.gap && <GapDivider />}
                      <BubbleRow
                        utterance={u}
                        byName={byName}
                        keyword={chat.keyword}
                      />
                    </div>
                  ))}

                  {/* Source note */}
                  <p className="text-[11px] text-stone-400 text-center pt-3 pb-1 leading-relaxed">
                    출처: 국회도서관 지방의정포털. 키워드 전후 발언만 추출한 요약본입니다.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
