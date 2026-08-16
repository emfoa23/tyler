import { cache } from "react";
import { db } from "./db";
import type { Draw, RankingRow, Store } from "./types";

export const DRAWS_PER_PAGE = 20;
export const RANKING_PER_PAGE = 30;

export const getLatestDraw = cache(async (): Promise<Draw | null> => {
  const { data, error } = await db
    .from("draws").select("*")
    .order("draw_no", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  return data;
});

export async function getDraws(page: number) {
  const from = (page - 1) * DRAWS_PER_PAGE;
  const { data, error, count } = await db
    .from("draws").select("*", { count: "exact" })
    .order("draw_no", { ascending: false })
    .range(from, from + DRAWS_PER_PAGE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as Draw[], total: count ?? 0 };
}

export const getDraw = cache(async (drawNo: number): Promise<Draw | null> => {
  const { data, error } = await db
    .from("draws").select("*").eq("draw_no", drawNo).maybeSingle();
  if (error) throw error;
  return data;
});

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

export async function getRanking(params: {
  rank?: "all" | "1" | "2";
  years?: number | null;
  sido?: string | null;
  limit?: number;
  offset?: number;
}): Promise<RankingRow[]> {
  const { data, error } = await db.rpc("store_ranking", {
    p_rank: params.rank ?? "all",
    p_years: params.years ?? null,
    p_sido: params.sido ?? null,
    p_limit: params.limit ?? RANKING_PER_PAGE,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as RankingRow[];
}

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
