import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallRow } from "@/components/ball";
import { JsonLd } from "@/components/json-ld";
import { PagedList } from "@/components/paged-list";
import { StoreBadges } from "@/components/store-badge";
import { dateK, won, wonShort } from "@/lib/format";
import { drawNumbers, isOnlineStore, methodLabel, storeDisplayName } from "@/lib/lotto";
import { getDraw, getDrawWins, getLatestDraw, type DrawWin } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ draw: string }>;
}): Promise<Metadata> {
  const { draw } = await params;
  return {
    title: `제${draw}회 당첨 결과`,
    description: `로또 6/45 제${draw}회 당첨번호, 등위별 당첨금, 1·2등 배출점`,
  };
}

const RANKS = [1, 2, 3, 4, 5] as const;

function WinList({ wins, rank }: { wins: DrawWin[]; rank: 1 | 2 }) {
  const rows = wins.filter((w) => w.rank === rank);
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-stone-600">
        {rank}등 배출점 <span className="font-normal text-stone-400">({rows.length}건)</span>
      </h3>
      <PagedList
        pageSize={10}
        className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white"
        items={rows.map((w, i) => (
          <li key={`${w.store.store_id}-${i}`}>
            <Link
              href={`/stores/${w.store.store_id}`}
              className="flex items-center gap-2 px-3 py-2.5 hover:bg-stone-50"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{storeDisplayName(w.store)}</span>
                  <StoreBadges storeId={w.store.store_id} status={w.store.status} />
                </span>
                <span className="truncate text-xs text-stone-500">
                  {isOnlineStore(w.store.store_id)
                    ? "전국 온라인 구매 합산"
                    : [w.store.sido, w.store.sigungu].filter(Boolean).join(" ")}
                </span>
              </span>
              {methodLabel(w.method) && (
                <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                  {methodLabel(w.method)}
                </span>
              )}
            </Link>
          </li>
        ))}
      />
    </div>
  );
}

export default async function DrawDetailPage({
  params,
}: {
  params: Promise<{ draw: string }>;
}) {
  const { draw: drawParam } = await params;
  const drawNo = Number(drawParam);
  if (!Number.isInteger(drawNo) || drawNo < 1) notFound();

  const draw = await getDraw(drawNo);
  if (!draw) notFound();

  const [wins, latest] = await Promise.all([getDrawWins(drawNo), getLatestDraw()]);

  const rankRows = RANKS.map((r) => ({
    rank: r,
    winners: draw[`r${r}_winners` as const],
    each: draw[`r${r}_prize_each` as const],
    total: draw[`r${r}_prize_total` as const],
  }));

  return (
    <div className="space-y-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "홈", item: "https://lottogen.click" },
            { "@type": "ListItem", position: 2, name: "당첨 결과", item: "https://lottogen.click/history" },
            { "@type": "ListItem", position: 3, name: `제${draw.draw_no}회` },
          ],
        }}
      />
      <nav className="flex items-center justify-between text-sm">
        <Link
          href={`/history/${drawNo - 1}`}
          className={`rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50 ${drawNo <= 1 ? "invisible" : ""}`}
        >
          ← 제{drawNo - 1}회
        </Link>
        <Link href="/history" className="text-stone-500 hover:underline">
          전체 회차
        </Link>
        <Link
          href={`/history/${drawNo + 1}`}
          className={`rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50 ${latest && drawNo >= latest.draw_no ? "invisible" : ""}`}
        >
          제{drawNo + 1}회 →
        </Link>
      </nav>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="text-xl font-bold">제{draw.draw_no}회</h1>
          <span className="text-sm text-stone-500">{dateK(draw.draw_date)} 추첨</span>
        </div>
        <div className="mt-4">
          <BallRow numbers={drawNumbers(draw)} bonus={draw.bonus} size="lg" />
        </div>
        {(draw.first_auto ?? draw.first_manual ?? draw.first_semi) !== null && (
          <p className="mt-3 text-sm text-stone-500">
            1등 구매 유형 — 자동 {draw.first_auto ?? 0} · 수동 {draw.first_manual ?? 0} · 반자동{" "}
            {draw.first_semi ?? 0}
          </p>
        )}
        {draw.sales_total !== null && (
          <p className="mt-1 text-sm text-stone-500">회차 판매액 {wonShort(draw.sales_total)}</p>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">등위별 당첨</h2>
        {/* 375px 에서 좌우 스크롤 없이 다 보이도록 총액 열은 sm 이상에서만 */}
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="py-2 font-medium">등위</th>
              <th className="py-2 text-right font-medium">당첨자</th>
              <th className="py-2 text-right font-medium">1인당 당첨금</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">총 당첨금</th>
            </tr>
          </thead>
          <tbody>
            {rankRows.map((r) => (
              <tr key={r.rank} className="border-b border-stone-100 last:border-0">
                <td className="py-2 font-semibold">{r.rank}등</td>
                <td className="py-2 text-right">{r.winners?.toLocaleString("ko-KR") ?? "-"}명</td>
                <td className="py-2 text-right">{won(r.each)}</td>
                <td className="hidden py-2 text-right text-stone-500 sm:table-cell">{wonShort(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold">1·2등 배출점</h2>
        {wins.length ? (
          <>
            <WinList wins={wins} rank={1} />
            <WinList wins={wins} rank={2} />
            <p className="text-xs text-stone-400">
              행 하나가 당첨 게임 1건입니다 (같은 지점이 자동·수동으로 여러 번 나올 수 있음).
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
            {drawNo < 262
              ? "배출점 정보는 262회차(2007년 12월)부터 제공됩니다."
              : "배출점 정보가 아직 공개되지 않았습니다."}
          </p>
        )}
      </section>
    </div>
  );
}
