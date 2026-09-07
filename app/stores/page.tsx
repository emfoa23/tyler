import type { Metadata } from "next";
import Link from "next/link";
import { SectionTabs } from "@/components/section-tabs";
import { StoreBadges } from "@/components/store-badge";
import { StoresFilter } from "@/components/stores-filter";
import { dateShort } from "@/lib/format";
import {
  SIDO_LIST, STORES_TABS, isOnlineStore, parsePeriod, periodDraws, periodParam, storeDisplayName, type Period,
} from "@/lib/lotto";
import { RANKING_PER_PAGE, getLatestDraw, getRanking } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";

// 검색 파라미터(searchParams)를 읽어 Next 가 요청마다 렌더하는 화면 — 페이지 캐시 대신 조회 결과를
// 태그 데이터 캐시(lib/queries, lib/cache-policy)에 7일 보관하고 동기화가 태그로 지운다.

type Params = { rank?: string; months?: string; draws?: string; years?: string; sido?: string; open?: string; page?: string };

function sidoOf(params: Params): string | null {
  return SIDO_LIST.includes(params.sido ?? "") ? params.sido! : null;
}

// `?sido=` 변형은 별도 페이지 없이 지역명 title + 자기 canonical 로 색인되게 한다
// ("서울 로또 명당 순위" 검색 → /stores?sido=서울). rank/기간/open/page 는 같은 내용의 보기 차이라 canonical 에서 제외.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const sido = sidoOf(await searchParams);
  return pageMeta({
    core: sido ? `${sido} 로또 명당 순위` : "전국 로또 명당 순위",
    description: "내 동네 1등 배출점을 찾아보세요",
    path: sido ? `/stores?sido=${encodeURIComponent(sido)}` : "/stores",
  });
}

type Query = { rank: "all" | "1" | "2"; period: Period; sido: string | null; open: boolean };

// 페이지네이션 링크용 — 기본값(전체·전체 기간·전국·1페이지)은 생략한다
function qs(q: Query, page: number): string {
  const parts: string[] = [];
  if (q.rank !== "all") parts.push(`rank=${q.rank}`);
  const p = periodParam(q.period);
  if (p) parts.push(p);
  if (q.sido) parts.push(`sido=${encodeURIComponent(q.sido)}`);
  if (q.open) parts.push("open=1");
  if (page > 1) parts.push(`page=${page}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const rank = ["1", "2"].includes(params.rank ?? "") ? (params.rank as "1" | "2") : "all";
  // 구 URL(months=·years=)은 parsePeriod 가 회차로 환산해 받는다 — 새 링크는 draws 만
  const period = parsePeriod(params);
  const sido = sidoOf(params);
  const open = params.open === "1"; // 폐점 제외
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * RANKING_PER_PAGE;
  const query: Query = { rank, period, sido, open };

  // 기간 창 = 최근 N회 (최신 회차 이상은 전체와 같아 null 로 정규화 — lib/lotto periodDraws)
  const latest = await getLatestDraw();
  const rows = await getRanking({
    rank,
    draws: periodDraws(period, latest?.draw_no ?? 0),
    sido,
    open,
    limit: RANKING_PER_PAGE + 1,
    offset,
  });
  const hasMore = rows.length > RANKING_PER_PAGE;
  const visible = rows.slice(0, RANKING_PER_PAGE);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{sido ? `${sido} 로또 명당 순위` : "로또 명당 순위"}</h1>

      <SectionTabs tabs={STORES_TABS} current="/stores" />

      <StoresFilter rank={rank} period={period} sido={sido ?? "all"} open={open} />

      <ol className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4">
        {visible.map((s) => (
          <li key={s.store_id}>
            <Link href={`/stores/${s.store_id}`} className="flex items-center gap-3 py-3 hover:bg-stone-50">
              {/* 표준 경쟁 순위 — 동률(전체: 1등·2등 수 모두 같음, 등수 필터: 그 등수 인원 같음)은 같은 번호 */}
              <span className="w-8 shrink-0 text-center font-bold text-stone-400">
                {s.rnk}
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
            href={`/stores${qs(query, page - 1)}`}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 hover:bg-stone-50"
          >
            ← 이전
          </Link>
        ) : <span />}
        {hasMore && (
          <Link
            href={`/stores${qs(query, page + 1)}`}
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
