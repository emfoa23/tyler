import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallRow } from "@/components/ball";
import { JsonLd } from "@/components/json-ld";
import { PagedList } from "@/components/paged-list";
import { StoreBadges } from "@/components/store-badge";
import { dateK, won, wonShort } from "@/lib/format";
import {
  drawNumbers, firstTypeSummary, isOnlineStore, methodLabel, methodSummary, storeDisplayName,
} from "@/lib/lotto";
import { getDraw, getDrawWins, getLatestDraw, type DrawWin } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

// 검색 스니펫·OG·JSON-LD 공용 요약 — 화면엔 같은 정보가 표·메타 줄로 이미 있어 본문에는 넣지 않는다.
function drawSummary(draw: NonNullable<Awaited<ReturnType<typeof getDraw>>>): string {
  const nums = drawNumbers(draw).join("·");
  const parts = [
    `로또 6/45 ${draw.draw_no}회(${dateK(draw.draw_date)} 추첨) 당첨번호 ${nums}, 보너스 ${draw.bonus}.`,
  ];
  const ranks = ([1, 2, 3] as const)
    .map((r) => {
      const n = draw[`r${r}_winners` as const];
      const each = draw[`r${r}_prize_each` as const];
      return n === null ? null : `${r}등 ${n.toLocaleString("ko-KR")}명${each === null ? "" : ` 각 ${won(each)}`}`;
    })
    .filter((x): x is string => x !== null);
  if (ranks.length) parts.push(`${ranks.join(", ")}.`);
  const types = firstTypeSummary(draw);
  if (types) parts.push(`1등 구매 유형 ${types}.`);
  if (draw.sales_total !== null) parts.push(`회차 판매액 ${wonShort(draw.sales_total)}.`);
  parts.push("1·2등 배출점 목록 포함.");
  return parts.join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ draw: string }>;
}): Promise<Metadata> {
  const { draw: drawParam } = await params;
  const drawNo = Number(drawParam);
  const draw = Number.isInteger(drawNo) && drawNo >= 1 ? await getDraw(drawNo) : null;
  if (!draw) {
    return pageMeta({
      core: `${drawParam}회 당첨 결과`,
      description: "다른 회차를 선택해보세요",
      path: `/history/${drawParam}`,
      noindex: true,
    });
  }
  // 당첨번호는 title/description 에 넣지 않는다(페이지에 들어와야 보이게) — 구조화 데이터(JSON-LD)에만 둔다.
  const [y, m, d] = draw.draw_date.split("-").map(Number);
  return pageMeta({
    core: `로또 ${draw.draw_no}회 당첨번호`,
    description: `${y}.${m}.${d} 추첨, 1등 배출점까지 확인하세요`,
    path: `/history/${draw.draw_no}`,
  });
}

const RANKS = [1, 2, 3, 4, 5] as const;

function WinList({ wins, rank }: { wins: DrawWin[]; rank: 1 | 2 }) {
  const rows = wins.filter((w) => w.rank === rank);
  if (!rows.length) return null;

  // 지점당 한 줄로 합산 — 당첨 게임 수 desc (동률은 조회 순서 store_id asc, sort 안정성으로 유지)
  const byStore = new Map<
    string,
    { store: DrawWin["store"]; total: number; methods: Map<string, number> }
  >();
  for (const w of rows) {
    const entry = byStore.get(w.store.store_id) ?? { store: w.store, total: 0, methods: new Map() };
    entry.total += 1;
    const label = methodLabel(w.method);
    if (label) entry.methods.set(label, (entry.methods.get(label) ?? 0) + 1);
    byStore.set(w.store.store_id, entry);
  }
  const stores = [...byStore.values()].sort((a, b) => b.total - a.total);

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-stone-600">
        {rank}등 배출점 <span className="font-normal text-stone-400">({rows.length}명)</span>
      </h3>
      <PagedList
        pageSize={10}
        className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white"
        items={stores.map((s) => (
          <li key={s.store.store_id}>
            <Link
              href={`/stores/${s.store.store_id}`}
              className="flex items-center gap-2 px-3 py-2.5 hover:bg-stone-50"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{storeDisplayName(s.store)}</span>
                  <StoreBadges storeId={s.store.store_id} status={s.store.status} />
                </span>
                <span className="truncate text-xs text-stone-500">
                  {isOnlineStore(s.store.store_id)
                    ? "전국 온라인 구매 합산"
                    : [s.store.sido, s.store.sigungu].filter(Boolean).join(" ")}
                </span>
              </span>
              {s.total > 1 ? (
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold">{s.total}명</span>
                  {s.methods.size > 0 && (
                    <span className="block text-xs text-stone-400">{methodSummary(s.methods)}</span>
                  )}
                </span>
              ) : (
                s.methods.size > 0 && (
                  <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                    {[...s.methods.keys()][0]}
                  </span>
                )
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
  // 1등 구매유형 요약 — 0건 유형 생략, 공개 전·데이터 없는 구회차(≤261)는 null 이라 줄 자체를 숨긴다.
  const firstTypes = firstTypeSummary(draw);

  return (
    <div className="space-y-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "홈", item: "https://lottogen.click" },
            { "@type": "ListItem", position: 2, name: "당첨 결과", item: "https://lottogen.click/history" },
            { "@type": "ListItem", position: 3, name: `${draw.draw_no}회` },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `로또 ${draw.draw_no}회 당첨번호`,
          description: drawSummary(draw),
          url: `https://lottogen.click/history/${draw.draw_no}`,
          datePublished: draw.draw_date,
          inLanguage: "ko",
          isPartOf: { "@type": "WebSite", name: "lottogen", url: "https://lottogen.click" },
        }}
      />
      <nav className="flex items-center justify-between text-sm">
        <Link
          href={`/history/${drawNo - 1}`}
          className={`rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50 ${drawNo <= 1 ? "invisible" : ""}`}
        >
          ← {drawNo - 1}회<span className="hidden sm:inline"> 당첨번호</span>
        </Link>
        <Link href="/history" className="text-stone-500 hover:underline">
          전체 회차
        </Link>
        <Link
          href={`/history/${drawNo + 1}`}
          className={`rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50 ${latest && drawNo >= latest.draw_no ? "invisible" : ""}`}
        >
          {drawNo + 1}회<span className="hidden sm:inline"> 당첨번호</span> →
        </Link>
      </nav>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        {/* 제목이 길어 375px 에선 날짜를 아래 줄로 — sm 이상은 기존처럼 양끝 한 줄 */}
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
          <h1 className="text-xl font-bold">로또 {draw.draw_no}회 당첨번호</h1>
          <span className="text-sm text-stone-500">{dateK(draw.draw_date)} 추첨</span>
        </div>
        <div className="mt-4">
          <BallRow numbers={drawNumbers(draw)} bonus={draw.bonus} size="lg" />
        </div>
        {/* 메타 줄은 한 그룹으로 — 구매유형 줄이 없어도 공과의 간격(mt-3)이 같게 유지된다 */}
        {(firstTypes || draw.sales_total !== null) && (
          <div className="mt-3 space-y-1 text-sm text-stone-500">
            {firstTypes && <p>1등 구매 유형 — {firstTypes}</p>}
            {draw.sales_total !== null && <p>회차 판매액 {wonShort(draw.sales_total)}</p>}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">{draw.draw_no}회 등위별 당첨금</h2>
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
        <h2 className="font-bold">{draw.draw_no}회 1·2등 배출점</h2>
        {wins.length ? (
          <>
            <WinList wins={wins} rank={1} />
            <WinList wins={wins} rank={2} />
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
