import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_TAGS, CACHE_TTL_SECONDS } from "./cache-policy";
import { db } from "./db";
import type { Draw, RankingRow, Store, StoreSearchRow, WinningSet } from "./types";

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

// 기간 창은 회차 수 하나(draws = 최근 N회, null = 전체 — lib/lotto Period). 회차 뺄셈이라 날짜가 지나도 결과가
// 안 흔들려 캐시가 안전하다(2026-09-07, 이전의 최신 추첨일 앵커 규칙을 대체).
export const getRanking = unstable_cache(
  async (params: {
    rank?: "all" | "1" | "2";
    draws?: number | null;
    sido?: string | null;
    open?: boolean; // 폐점 제외
    limit?: number;
    offset?: number;
  }): Promise<RankingRow[]> => {
    const { data, error } = await db.rpc("store_ranking", {
      p_rank: params.rank ?? "all",
      p_draws: params.draws ?? null,
      p_sido: params.sido ?? null,
      p_open: params.open ?? false,
      p_limit: params.limit ?? RANKING_PER_PAGE,
      p_offset: params.offset ?? 0,
    });
    if (error) throw error;
    return (data ?? []) as RankingRow[];
  },
  ["store-ranking"],
  { tags: [CACHE_TAGS.ranking], revalidate: CACHE_TTL_SECONDS },
);

// 판매점 검색 — 마스터 전체 지점 대상(배출 이력 없는 지점 포함), 공백으로 나눈 토큰이 상호+주소에 모두 들어가야 한다(지역 필터 없음).
// 정렬은 상호 완전일치 → 1등 수 → 2등 수 → 상호(SQL store_search). 지점·배출 데이터가 바뀌면 ranking 태그로 지워진다.
export const getStoreSearch = unstable_cache(
  async (params: {
    q: string;
    open?: boolean; // 폐점 제외
    limit?: number;
    offset?: number;
  }): Promise<StoreSearchRow[]> => {
    const { data, error } = await db.rpc("store_search", {
      p_q: params.q,
      p_open: params.open ?? false,
      p_limit: params.limit ?? RANKING_PER_PAGE,
      p_offset: params.offset ?? 0,
    });
    if (error) throw error;
    return (data ?? []) as StoreSearchRow[];
  },
  ["store-search"],
  { tags: [CACHE_TAGS.ranking], revalidate: CACHE_TTL_SECONDS },
);

export type NumberFrequencyRow = {
  num: number;
  cnt: number;
  last_draw: number | null;
  last_date: string | null;
};

// 45행 고정이라 limit 은 클라이언트 slice 로 충분 (시그니처 최소 유지).
// with 는 조건 번호(같이 나온 번호) — 그 번호를 모두 포함한 회차만 세고, 조건 번호 자신의 행 값이 곧 동반 출현 횟수.
// 비어 있으면 자주 나오는 번호와 같다(함수 하나가 한 개념).
export const getNumberFrequency = unstable_cache(
  async (params: {
    draws?: number | null;
    bonus?: boolean;
    with?: number[];
    limit?: number;
  }): Promise<NumberFrequencyRow[]> => {
    const { data, error } = await db.rpc("number_frequency", {
      p_draws: params.draws ?? null,
      p_bonus: params.bonus ?? false,
      p_with: params.with ?? [],
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
