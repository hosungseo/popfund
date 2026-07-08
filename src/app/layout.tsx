import type { Metadata } from "next";
import { Noto_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { loadMeta } from "@/lib/data";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | 지방소멸대응기금 워치",
    default: "지방소멸대응기금 워치",
  },
  description:
    "인구감소지역(89개)·관심지역(18개)의 인구 변화와 지방소멸대응기금 집행 현황을 한눈에 보는 모니터링 대시보드",
  keywords: [
    "인구감소지역", "지방소멸대응기금", "관심지역", "지방재정365",
    "주민등록인구", "인구 추이", "행정안전부",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "지방소멸대응기금 워치",
    title: "지방소멸대응기금 워치",
    description:
      "인구감소지역 89곳·관심지역 18곳의 인구 변화와 지방소멸대응기금 집행 현황 모니터링",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const meta = loadMeta();

  return (
    <html
      lang="ko"
      className={`${notoSansKR.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-900">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer meta={meta} />
      </body>
    </html>
  );
}
