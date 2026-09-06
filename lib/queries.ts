import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "./cache-policy";
import { db } from "./db";
import type { Draw, RankingRow, Store, WinningSet } from "./types";

export const DRAWS_PER_PAGE = 20;
export const RANKING_PER_PAGE = 30;

// 데이터 캐시 — 검색 파라미터를 읽는 화면(회차 목록·명당 순위·번호 통계)은 Next 가 페이지 캐시를 끄므로
// 조회 결과를 태그 캐시에 7일 보관하고, 동기화가 태그로 지운다(lib/cache-policy). 인자는 자동으로 키에 포함된다.
// (unstable_cache 는 Next 16 에서 deprecated 표기지만 cacheComponents 없이 쓸 수 있는 유일한 태그 캐시다.)
const cachedLatestDraw = unstable_cache(
  async (): Promise<Draw | null> => {
    const { data, error } = await db
      .from("draws").select("*")
      .order("draw_no", { ascending: false })
      .limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
  ["latest-draw"],
  { tags: [CACHE_TAGS.draws], revalidate: CACHE_TTL_SECONDS },
);
export const getLatestDraw = cache(cachedLatestDraw);

export const getDraws = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * DRAWS_PER_PAGE;
    const { data, error, count } = await db
      .from("draws").select("*", { count: "exact" })
      .order("draw_no", { ascending: false })
      .range(from, from + DRAWS_PER_PAGE - 1);
    if (error) throw error;
    return { rows: (data ?? []) as Draw[], total: count ?? 0 };
  },
  ["draws-page"],
  { tags: [CACHE_TAGS.draws], revalidate: CACHE_TTL_SECONDS },
);

export const getDraw = cache(async (drawNo: number): Promise<Draw | null> => {
  const { data, error } = await db
    .from("draws").select("*").eq("draw_no", drawNo).maybeSingle();
  if (error) throw error;
  return data;
});

// 그 기기의 해당 회차 당첨 세트 — 자랑 이미지와 공유 착지(/share/{token})가 같은 순서를 쓰는 단일 소스:
// 등수 오름차순(높은 등수 먼저), 같은 등수는 id 오름차순(먼저 만든 세트 먼저). 2026-09-05 통일.
export async function getWinningSets(clientId: string, drawNo: number): Promise<WinningSet[]> {
  const { data, error } = await db
    .from("generated_sets")
    .select("id, numbers, matched_rank")
    .eq("client_id", clientId)
    .eq("target_draw", drawNo)
    .gte("matched_rank", 1)
    .order("matched_rank", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WinningSet[];
}

export type DrawWin = {
  rank: 1 | 2;
  method: string | null;
  store: Pick<Store, "store_id" | "name" | "sido" | "sigungu" | "address" | "status">;
};

export async function getDrawWins(drawNo: number): Promise<DrawWin[]> {
  const { data, error } = await db
    .from("store_wins")
    .select("rank, method, store:stores(store_id, name, sido, sigungu, address, status)")
    .eq("draw_no", drawNo)
    .order("rank", { ascending: true })
    .order("store_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DrawWin[];
}

// 기간 창(months)의 기준일은 오늘이 아니라 최신 추첨일(anchor) — 결과가 날짜가 아니라 회차 이벤트 때만
// 바뀌어 캐시를 길게 둘 수 있다(2026-09-06 사용자 확정). months 가 없으면 기준일은 무의미.
export const getRanking = unstable_cache(
  async (params: {
    rank?: "all" | "1" | "2";
    months?: number | null;
    sido?: string | null;
    limit?: number;
    offset?: number;
    anchor?: string | null; // YYYY-MM-DD, 최신 추첨일
  }): Promise<RankingRow[]> => {
    const { data, error } = await db.rpc("store_ranking", {
      p_rank: params.rank ?? "all",
      p_months: params.months ?? null,
      p_sido: params.sido ?? null,
      p_limit: params.limit ?? RANKING_PER_PAGE,
      p_offset: params.offset ?? 0,
      ...(params.months && params.anchor ? { p_anchor: params.anchor } : {}),
    });
    if (error) throw error;
    return (data ?? []) as RankingRow[];
  },
  ["store-ranking"],
  { tags: [CACHE_TAGS.ranking], revalidate: CACHE_TTL_SECONDS },
);

export type NumberFrequencyRow = {
  num: number;
  cnt: number;
  last_draw: number | null;
  last_date: string | null;
};

// 45행 고정이라 limit 은 클라이언트 slice 로 충분 (시그니처 최소 유지)
export const getNumberFrequency = unstable_cache(
  async (params: {
    months?: number | null;
    bonus?: boolean;
    limit?: number;
    anchor?: string | null; // YYYY-MM-DD, 최신 추첨일 (getRanking 과 같은 규칙)
  }): Promise<NumberFrequencyRow[]> => {
    const { data, error } = await db.rpc("number_frequency", {
      p_months: params.months ?? null,
      p_bonus: params.bonus ?? false,
      ...(params.months && params.anchor ? { p_anchor: params.anchor } : {}),
    });
    if (error) throw error;
    const rows = (data ?? []) as NumberFrequencyRow[];
    return params.limit ? rows.slice(0, params.limit) : rows;
  },
  ["number-frequency"],
  { tags: [CACHE_TAGS.numbers], revalidate: CACHE_TTL_SECONDS },
);

export const getStore = cache(async (storeId: string): Promise<Store | null> => {
  const { data, error } = await db
    .from("stores").select("*").eq("store_id", storeId).maybeSingle();
  if (error) throw error;
  return data;
});

export type StoreWinRow = {
  draw_no: number;
  draw_date: string;
  rank: 1 | 2;
  method: string | null;
  draw: { n1: number; n2: number; n3: number; n4: number; n5: number; n6: number; bonus: number } | null;
};

export async function getStoreWins(storeId: string): Promise<StoreWinRow[]> {
  const { data, error } = await db
    .from("store_wins")
    .select("draw_no, draw_date, rank, method, draw:draws(n1, n2, n3, n4, n5, n6, bonus)")
    .eq("store_id", storeId)
    .order("draw_no", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as StoreWinRow[];
}
