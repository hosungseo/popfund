"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "전국 개요" },
  { href: "/compare", label: "지역 비교" },
  { href: "/projects", label: "사업 탐색" },
  { href: "/insights", label: "인사이트" },
  { href: "/policy", label: "정책 시사점" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          <span className="font-bold text-stone-900 text-sm leading-tight">
            지방소멸대응기금 워치
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-stone-100 text-stone-900"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
