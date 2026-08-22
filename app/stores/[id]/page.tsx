import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallRow } from "@/components/ball";
import { JsonLd } from "@/components/json-ld";
import { PagedList } from "@/components/paged-list";
import { StoreBadges } from "@/components/store-badge";
import { dateShort } from "@/lib/format";
import { isOnlineStore, methodLabel, methodSummary, storeDisplayName } from "@/lib/lotto";
import { getStore, getStoreWins, type StoreWinRow } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const store = await getStore(id);
  if (!store) return { title: "지점" };
  const where = isOnlineStore(store.store_id)
    ? "동행복권 공식 온라인 판매 채널"
    : [store.sido, store.sigungu].filter(Boolean).join(" ");
  return {
    title: `${storeDisplayName(store)} — 배출 이력`,
    description: `${where ? `${where} ` : ""}${storeDisplayName(store)}의 로또 1·2등 배출 이력과 회차별 당첨 기록`,
  };
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const store = await getStore(id);
  if (!store) notFound();

  const wins = await getStoreWins(id);
  const r1 = wins.filter((w) => w.rank === 1).length;
  const r2 = wins.length - r1;
  const online = isOnlineStore(store.store_id);
  const mapQuery = [store.name, store.address].filter(Boolean).join(" ");

  // 같은 회차·같은 등수의 당첨자를 한 줄로 합산 (회차 desc, 같은 회차는 1등 먼저)
  const byDrawRank = new Map<
    string,
    { draw_no: number; draw_date: string; rank: 1 | 2; total: number; methods: Map<string, number>; draw: StoreWinRow["draw"] }
  >();
  for (const w of wins) {
    const key = `${w.draw_no}-${w.rank}`;
    const g = byDrawRank.get(key) ?? {
      draw_no: w.draw_no, draw_date: w.draw_date, rank: w.rank, total: 0, methods: new Map(), draw: w.draw,
    };
    g.total += 1;
    const label = methodLabel(w.method);
    if (label) g.methods.set(label, (g.methods.get(label) ?? 0) + 1);
    byDrawRank.set(key, g);
  }
  const history = [...byDrawRank.values()].sort((a, b) => b.draw_no - a.draw_no || a.rank - b.rank);

  return (
    <div className="space-y-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "홈", item: "https://lottogen.click" },
            { "@type": "ListItem", position: 2, name: "명당 순위", item: "https://lottogen.click/stores" },
            { "@type": "ListItem", position: 3, name: storeDisplayName(store) },
          ],
        }}
      />
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{storeDisplayName(store)}</h1>
          <StoreBadges storeId={store.store_id} status={store.status} />
        </div>
        {online ? (
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            동행복권 공식 온라인 판매 채널입니다. 전국 온라인 구매 당첨이 모두 이 채널 하나로
            집계되므로, 오프라인 지점과는 성격이 다릅니다.
          </p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-stone-500">
            {store.address && <p>{store.address}</p>}
            {store.phone && <p>{store.phone}</p>}
            {mapQuery && (
              <a
                href={`https://map.naver.com/p/search/${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-amber-600 hover:underline"
              >
                네이버 지도에서 보기 →
              </a>
            )}
          </div>
        )}
        <dl className="mt-4 flex flex-wrap gap-2 text-sm sm:gap-3">
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <dt className="inline text-stone-500">1등 </dt>
            <dd className="inline font-bold">{r1}명</dd>
          </div>
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <dt className="inline text-stone-500">2등 </dt>
            <dd className="inline font-bold">{r2}명</dd>
          </div>
          {wins[0] && (
            <div className="rounded-lg bg-stone-50 px-3 py-2">
              <dt className="inline text-stone-500">최근 </dt>
              <dd className="inline font-bold">{dateShort(wins[0].draw_date)}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">배출 이력</h2>
        {wins.length ? (
          <PagedList
            pageSize={15}
            className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4"
            items={history.map((g) => (
              <li key={`${g.draw_no}-${g.rank}`}>
                <Link href={`/history/${g.draw_no}`} className="block py-3 hover:bg-stone-50">
                  {/* 좌: 회차+등수/날짜 스택 · 우: 인원/방식 스택 — 회차 상세 배출점 리스트와 같은 배치 */}
                  <span className="flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">제{g.draw_no}회</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                            g.rank === 1 ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {g.rank}등
                        </span>
                      </span>
                      <span className="text-xs text-stone-500">{dateShort(g.draw_date)}</span>
                    </span>
                    <span className="max-w-[55%] shrink-0 text-right">
                      {g.total > 1 && (
                        <span className="block text-sm font-semibold">{g.total}명</span>
                      )}
                      {g.methods.size > 0 && (
                        <span className="block text-xs text-stone-400">{methodSummary(g.methods)}</span>
                      )}
                    </span>
                  </span>
                  {g.draw && (
                    <span className="mt-1.5 block">
                      <BallRow
                        numbers={[g.draw.n1, g.draw.n2, g.draw.n3, g.draw.n4, g.draw.n5, g.draw.n6]}
                        size="sm"
                      />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          />
        ) : (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
            아직 1·2등 배출 이력이 없습니다.
          </p>
        )}
        <p className="text-xs text-stone-400">
          같은 회차·같은 등수의 당첨자는 한 줄로 합산했습니다. 2명 이상이면 인원을 표기합니다.
        </p>
      </section>
    </div>
  );
}
