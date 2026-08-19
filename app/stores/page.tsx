import type { Metadata } from "next";
import Link from "next/link";
import { StoreBadges } from "@/components/store-badge";
import { StoresFilter } from "@/components/stores-filter";
import { dateShort } from "@/lib/format";
import { SIDO_LIST, isOnlineStore, storeDisplayName } from "@/lib/lotto";
import { RANKING_PER_PAGE, getRanking } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "명당 랭킹",
  description: "로또 1·2등을 가장 많이 배출한 판매점 랭킹 — 지역·기간·등수별",
};

type Params = { rank?: string; months?: string; years?: string; sido?: string; page?: string };

function qs(p: Params, overrides: Partial<Params>): string {
  const merged: Record<string, string | undefined> = { ...p, ...overrides };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(merged)) {
    if (!v) continue;
    if ((k === "rank" || k === "months" || k === "sido") && v === "all") continue;
    if (k === "page" && v === "1") continue;
    parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const rank = ["1", "2"].includes(params.rank ?? "") ? (params.rank as "1" | "2") : "all";
  // 구 URL 호환: years=1|5 는 months 로 환산해 받는다
  const monthsParam =
    params.months ?? (params.years === "1" ? "12" : params.years === "5" ? "60" : undefined);
  const months = ["6", "12", "60"].includes(monthsParam ?? "") ? Number(monthsParam) : null;
  const sido = SIDO_LIST.includes(params.sido ?? "") ? params.sido! : null;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * RANKING_PER_PAGE;
  // 페이지네이션 링크용 정규화 쿼리 (legacy years 를 months 로 흡수)
  const query: Params = {
    rank: rank === "all" ? undefined : rank,
    months: months ? String(months) : undefined,
    sido: sido ?? undefined,
  };

  const rows = await getRanking({
    rank,
    months,
    sido,
    limit: RANKING_PER_PAGE + 1,
    offset,
  });
  const hasMore = rows.length > RANKING_PER_PAGE;
  const visible = rows.slice(0, RANKING_PER_PAGE);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">명당 랭킹</h1>

      <StoresFilter rank={rank} months={months ? String(months) : "all"} sido={sido ?? "all"} />

      <ol className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4">
        {visible.map((s, i) => (
          <li key={s.store_id}>
            <Link href={`/stores/${s.store_id}`} className="flex items-center gap-3 py-3 hover:bg-stone-50">
              <span className="w-8 shrink-0 text-center font-bold text-stone-400">
                {offset + i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{storeDisplayName(s)}</span>
                  <StoreBadges storeId={s.store_id} status={s.status} />
                </span>
                <span className="truncate text-xs text-stone-500">
                  {isOnlineStore(s.store_id)
                    ? "전국 온라인 구매 합산"
                    : [s.sido, s.sigungu].filter(Boolean).join(" ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold">
                  {rank === "all" ? `1등 ${s.r1} · 2등 ${s.r2}` : `${s.total}명`}
                </span>
                <span className="block text-xs text-stone-400">최근 {dateShort(s.last_win)}</span>
              </span>
            </Link>
          </li>
        ))}
        {!visible.length && (
          <li className="py-8 text-center text-sm text-stone-500">조건에 맞는 지점이 없습니다.</li>
        )}
      </ol>

      <nav className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link
            href={`/stores${qs(query, { page: String(page - 1) })}`}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
          >
            ← 이전
          </Link>
        ) : <span />}
        {hasMore && (
          <Link
            href={`/stores${qs(query, { page: String(page + 1) })}`}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
          >
            다음 →
          </Link>
        )}
      </nav>

      <p className="text-xs leading-relaxed text-stone-400">
        1·2등 배출 이력(배출점 데이터가 제공되는 262회차, 2007년 12월 이후) 기준.
        &lsquo;동행복권 사이트&rsquo;는 전국 온라인 구매 당첨이 한 채널로 합산 집계되는 항목입니다.
      </p>
    </div>
  );
}
