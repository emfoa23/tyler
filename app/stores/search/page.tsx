import type { Metadata } from "next";
import Link from "next/link";
import { SectionTabs } from "@/components/section-tabs";
import { StoreBadges } from "@/components/store-badge";
import { StoreSearchForm } from "@/components/store-search-form";
import { dateShort } from "@/lib/format";
import { STORES_TABS, STORE_SEARCH_MAX, STORE_SEARCH_MIN } from "@/lib/lotto";
import { RANKING_PER_PAGE, getStoreSearch } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";

// 판매점 검색 — 마스터 전체 지점(배출 이력 없는 지점 포함) 대상, 상호·주소 토큰 검색(2026-09-07).
// 검색 결과(q 있음)는 noindex, canonical 은 검색 루트. 조회 결과는 ranking 태그 데이터 캐시(lib/queries).

type Params = { q?: string; open?: string; page?: string };

function normalize(params: Params) {
  const q = (params.q ?? "").replace(/\s+/g, " ").trim().slice(0, STORE_SEARCH_MAX);
  const open = params.open === "1"; // 폐점 제외
  const page = Math.max(1, Number(params.page) || 1);
  return { q, open, page };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const { q } = normalize(await searchParams);
  return pageMeta({
    core: "로또 판매점 검색",
    description: "우리 동네 판매점의 배출 이력을 찾아보세요",
    path: "/stores/search",
    noindex: q.length > 0,
  });
}

function qs(q: string, open: boolean, page: number): string {
  return `?q=${encodeURIComponent(q)}${open ? "&open=1" : ""}${page > 1 ? `&page=${page}` : ""}`;
}

export default async function StoreSearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { q, open, page } = normalize(await searchParams);
  const offset = (page - 1) * RANKING_PER_PAGE;
  const ready = q.length >= STORE_SEARCH_MIN;
  const rows = ready ? await getStoreSearch({ q, open, limit: RANKING_PER_PAGE + 1, offset }) : [];
  const hasMore = rows.length > RANKING_PER_PAGE;
  const visible = rows.slice(0, RANKING_PER_PAGE);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">로또 판매점 검색</h1>

      <SectionTabs tabs={STORES_TABS} current="/stores/search" />

      <StoreSearchForm q={q} open={open} />

      {!ready ? (
        <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
          {q ? `${STORE_SEARCH_MIN}글자 이상 입력하세요.` : "상호나 주소의 일부를 입력하면 그 판매점의 1·2등 배출 이력을 보여줍니다."}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4">
            {visible.map((s) => (
              <li key={s.store_id}>
                <Link href={`/stores/${s.store_id}`} className="flex items-center gap-3 py-3 hover:bg-stone-50">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{s.name}</span>
                      <StoreBadges storeId={s.store_id} status={s.status} />
                    </span>
                    {/* 동명 지점이 많아(행운복권방 131곳) 보조줄은 시군구가 아니라 주소 */}
                    <span className="truncate text-xs text-stone-500">
                      {s.address ?? [s.sido, s.sigungu].filter(Boolean).join(" ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {s.total > 0 ? (
                      <>
                        <span className="block text-sm font-semibold">
                          1등 {s.r1} · 2등 {s.r2}
                        </span>
                        {s.last_win && (
                          <span className="block text-xs text-stone-400">최근 {dateShort(s.last_win)}</span>
                        )}
                      </>
                    ) : (
                      <span className="block text-xs text-stone-400">배출 이력 없음</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
            {!visible.length && (
              <li className="py-8 text-center text-sm text-stone-500">검색 결과가 없습니다.</li>
            )}
          </ul>

          <nav className="flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link
                href={`/stores/search${qs(q, open, page - 1)}`}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
              >
                ← 이전
              </Link>
            ) : <span />}
            {hasMore && (
              <Link
                href={`/stores/search${qs(q, open, page + 1)}`}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
              >
                다음 →
              </Link>
            )}
          </nav>
        </>
      )}

      <p className="text-xs leading-relaxed text-stone-400">
        동행복권 판매점 정보(주 1회 갱신) 기준이며, 배출 이력은 262회차(2007년 12월) 이후 1·2등입니다.
        온라인 판매 채널(동행복권 사이트)은 검색 대상이 아닙니다.
      </p>
    </div>
  );
}
