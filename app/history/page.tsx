import type { Metadata } from "next";
import Link from "next/link";
import { BallRow } from "@/components/ball";
import { dateShort, wonShort } from "@/lib/format";
import { drawNumbers } from "@/lib/lotto";
import { DRAWS_PER_PAGE, getDraws } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "로또 회차별 당첨 결과 — 1회차부터 전 회차 당첨번호·당첨금",
  description:
    "로또 6/45 1회차(2002년)부터 최신 회차까지 회차별 당첨번호·보너스 번호·1등 당첨자 수·1인당 당첨금. 회차를 누르면 등위별 당첨금과 1·2등 배출점을 볼 수 있습니다.",
  alternates: { canonical: "/history" },
  openGraph: {
    title: "로또 회차별 당첨 결과 | lottogen",
    description: "1회차부터 전 회차 당첨번호·보너스 번호·1등 당첨금",
    url: "/history",
  },
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await getDraws(page);
  const lastPage = Math.max(1, Math.ceil(total / DRAWS_PER_PAGE));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">로또 회차별 당첨 결과</h1>
      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4">
        {rows.map((d) => (
          <li key={d.draw_no}>
            <Link href={`/history/${d.draw_no}`} className="block py-3 hover:bg-stone-50">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-semibold">제{d.draw_no}회</span>
                <span className="text-xs text-stone-500">{dateShort(d.draw_date)}</span>
                <span className="ml-auto text-xs text-stone-500">
                  1등 {d.r1_winners ?? "-"}명 · 각 {wonShort(d.r1_prize_each)}
                </span>
              </span>
              <span className="mt-1.5 block">
                <BallRow numbers={drawNumbers(d)} bonus={d.bonus} size="sm" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <nav className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={`/history?page=${page - 1}`} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50">
            ← 최신 회차
          </Link>
        ) : <span />}
        <span className="text-stone-400">
          {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={`/history?page=${page + 1}`} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50">
            이전 회차 →
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
