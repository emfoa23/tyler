import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallRow } from "@/components/ball";
import { PagedList } from "@/components/paged-list";
import { StoreBadges } from "@/components/store-badge";
import { dateShort } from "@/lib/format";
import { isOnlineStore, methodLabel, storeDisplayName } from "@/lib/lotto";
import { getStore, getStoreWins } from "@/lib/queries";

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
  return { title: store ? `${storeDisplayName(store)} — 배출 이력` : "지점" };
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

  return (
    <div className="space-y-6">
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
            <dd className="inline font-bold">{r1}회</dd>
          </div>
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <dt className="inline text-stone-500">2등 </dt>
            <dd className="inline font-bold">{r2}회</dd>
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
            items={wins.map((w, i) => (
              <li key={i}>
                <Link href={`/history/${w.draw_no}`} className="block py-3 hover:bg-stone-50">
                  <span className="flex items-center gap-x-3">
                    <span className="text-sm font-semibold">제{w.draw_no}회</span>
                    <span className="text-xs text-stone-500">{dateShort(w.draw_date)}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                        w.rank === 1 ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {w.rank}등
                    </span>
                    {methodLabel(w.method) && (
                      <span className="text-xs text-stone-500">{methodLabel(w.method)}</span>
                    )}
                  </span>
                  {w.draw && (
                    <span className="mt-1.5 block">
                      <BallRow
                        numbers={[w.draw.n1, w.draw.n2, w.draw.n3, w.draw.n4, w.draw.n5, w.draw.n6]}
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
        <p className="text-xs text-stone-400">행 하나가 당첨 게임 1건입니다.</p>
      </section>
    </div>
  );
}
