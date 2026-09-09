import type { EventKind } from "@/lib/admin-labels";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export type EventsQuery = { kind: EventKind | null; clientId: string | null; page: number };

/** /admin/events 링크 — kind·client·page 만, 기본값은 생략(빈 쿼리면 경로만). */
export function eventsHref(q: EventsQuery): string {
  const u = new URLSearchParams();
  if (q.kind) u.set("kind", q.kind);
  if (q.clientId) u.set("client", q.clientId.toLowerCase());
  if (q.page > 1) u.set("page", String(q.page));
  const qs = u.toString();
  return `/admin/events${qs ? `?${qs}` : ""}`;
}
