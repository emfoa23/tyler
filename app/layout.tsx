import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SiteNav } from "@/components/site-nav";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import "./globals.css";

// Google AdSense 게시자 ID — 공개값(페이지 소스·ads.txt 에 노출되는 값). public/ads.txt 와 쌍.
const ADSENSE_CLIENT = "ca-pub-4095847360915092";

export const metadata: Metadata = {
  metadataBase: new URL("https://lottogen.click"),
  title: {
    default: "lottogen — 로또 당첨번호·명당·번호통계",
    template: "%s | lottogen",
  },
  description: "이번 주 결과를 확인하고 행운을 뽑아보세요",
  keywords: [
    "로또", "로또 번호 생성", "로또 번호 추천", "로또 당첨번호", "로또 당첨번호 조회",
    "로또 명당", "로또 1등 판매점", "로또 판매점", "로또 6/45", "당첨 통계",
    "로또 명당 순위", "로또 자주 나오는 번호", "로또 회차별 당첨번호",
  ],
  alternates: { canonical: "./" },
  openGraph: {
    title: "lottogen — 로또 당첨번호·명당·번호통계",
    description: "이번 주 결과를 확인하고 행운을 뽑아보세요",
    url: "https://lottogen.click",
    siteName: "lottogen",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "lottogen — 로또 당첨번호·명당·번호통계",
    description: "이번 주 결과를 확인하고 행운을 뽑아보세요",
  },
  robots: { index: true, follow: true },
  other: {
    "geo.region": "KR",
    "geo.placename": "대한민국",
    "content-language": "ko",
    "google-adsense-account": ADSENSE_CLIENT,
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "lottogen",
  alternateName: "로또젠 — 로또 당첨번호·명당·번호통계",
  url: "https://lottogen.click",
  inLanguage: "ko",
  description:
    "로또 6/45 회차별 당첨번호·당첨 결과, 1·2등 배출 명당 순위, 자주 나오는 번호 통계, 번호 생성을 제공하는 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col antialiased">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              <span className="text-amber-500">●</span> lottogen
            </Link>
            <SiteNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-6 text-xs leading-relaxed text-stone-400">
            <nav className="flex gap-4 font-medium text-stone-500">
              <Link href="/about" className="hover:underline">서비스 소개</Link>
              <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
            </nav>
            <p>
              당첨 결과·배출점 데이터의 출처는 동행복권 공개 데이터이며, 조회 시점에 따라 실제와
              차이가 있을 수 있습니다.
            </p>
            <p>번호 생성은 완전한 무작위이며 당첨을 보장하지 않습니다. 복권 구매는 책임질 수 있는 범위에서.</p>
          </div>
        </footer>
        <JsonLd data={JSON_LD} />
        <AnalyticsBeacon />
        {/* SSR HTML 에 포함시켜 애드센스 소유확인 크롤러가 JS 실행 없이도 보게 한다 */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
