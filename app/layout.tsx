import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lottogen.click"),
  title: {
    default: "lottogen — 로또 번호 생성기",
    template: "%s | lottogen",
  },
  description:
    "로또 6/45 번호 생성, 회차별 당첨 결과, 1·2등 배출 명당 랭킹. 생성한 번호가 실제로 당첨됐는지도 확인하세요.",
  openGraph: {
    title: "lottogen — 로또 번호 생성기",
    description: "로또 번호 생성 · 회차별 당첨 결과 · 명당 랭킹",
    url: "https://lottogen.click",
    locale: "ko_KR",
    type: "website",
  },
};

const NAV = [
  { href: "/generate", label: "번호 생성" },
  { href: "/history", label: "당첨 결과" },
  { href: "/stores", label: "명당 랭킹" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col antialiased">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              <span className="text-amber-500">●</span> lottogen
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto w-full max-w-3xl space-y-1 px-4 py-6 text-xs leading-relaxed text-stone-400">
            <p>
              본 사이트는 동행복권과 무관한 개인 프로젝트입니다. 당첨 결과·배출점 데이터의 출처는
              동행복권 공개 데이터이며, 조회 시점에 따라 실제와 차이가 있을 수 있습니다.
            </p>
            <p>번호 생성은 완전한 무작위이며 당첨을 보장하지 않습니다. 복권 구매는 책임질 수 있는 범위에서.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
