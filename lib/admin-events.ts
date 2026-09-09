import { db } from "@/lib/db";
import { type EventKind } from "@/lib/admin-labels";

// 원본 이벤트(analytics_events raw) 조회 — 서버 전용(db 가 service role). 클라이언트 컴포넌트에서 import 금지.
// 뷰어 규약: 최신순(created_at desc, id desc — 정렬키=표시키·id tiebreaker), 페이지 50건, 종류 필터만.
// UA·레퍼러 원문은 저장 시점에 파싱하지 않고(어떤 앱/브라우저가 오는지 미리 알 수 없음) 여기서 그대로 보여준다.
// raw 는 90일 prune 대상이므로 이 화면도 최근 90일이 상한이다.

export const EVENT_PAGE_SIZE = 50;

export type RawEvent = {
  id: number;
  created_at: string;
  day_kst: string;
  client_id: string;
  kind: EventKind;
  landing: string | null;
  src_kind: string | null;
  src_value: string | null;
  ft_kind: string | null;
  ft_value: string | null;
  draw_no: number | null;
  ua: string | null;
  referrer_url: string | null;
};

/** 1-base 페이지 파라미터 — 정수 문자열만, 나머지는 1. */
export function parsePageParam(raw: string | undefined): number {
  if (!raw || !/^[1-9]\d{0,5}$/.test(raw)) return 1;
  return Number(raw);
}

export async function getRawEvents(opts: {
  kind: EventKind | null;
  page: number;
}): Promise<{ rows: RawEvent[]; total: number; pageSize: number }> {
  const from = (opts.page - 1) * EVENT_PAGE_SIZE;
  const to = from + EVENT_PAGE_SIZE - 1;
  let q = db
    .from("analytics_events")
    .select(
      "id, created_at, day_kst, client_id, kind, landing, src_kind, src_value, ft_kind, ft_value, draw_no, ua, referrer_url",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, count, error } = await q;
  if (error) throw new Error(`raw events query failed: ${error.message}`);
  return { rows: (data ?? []) as RawEvent[], total: count ?? 0, pageSize: EVENT_PAGE_SIZE };
}
