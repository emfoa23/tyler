import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// 방문·이용 통계 수집(집계 전용) — 공개 라우트. 성공/드롭 모두 204(수집 실패가 이용을 막지 않는다).
// 'check' 는 클라이언트가 보낼 수 없다(GET /api/generate 가 서버에서 적재 — 위조 방지).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["visit", "generate_view"]);
const LANDINGS = new Set(["home", "generate", "history", "stores", "numbers", "about", "privacy", "other"]);
const SRC_KINDS = new Set(["direct", "referrer", "utm"]);
const DAILY_EVENT_CAP = 500; // 기기당/일 — 남용 flood 방지(정상 사용은 세션당 2행 수준)
// 크롤러 백스톱(클라 게이트와 동일 기준) — UA 는 판별에만 쓰고 저장하지 않는다.
const BOT_UA_RE =
  /bot|spider|crawl|slurp|headless|lighthouse|preview|yeti|daum|petal|semrush|ahrefs|yandex|baidu|bytespider|gptbot/i;

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}

function normValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().slice(0, 64);
  if (!s || s.includes("@") || s.includes("%40") || s.includes("?") || s.includes("=")) return null;
  return s;
}

function normSource(v: unknown): { kind: string; value: string } | null {
  if (!v || typeof v !== "object") return null;
  const kind = (v as { kind?: unknown }).kind;
  const value = normValue((v as { value?: unknown }).value);
  if (typeof kind !== "string" || !SRC_KINDS.has(kind) || !value) return null;
  return { kind, value };
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA_RE.test(ua)) return noContent();

  const body = await req.json().catch(() => ({}));
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!UUID_RE.test(clientId) || !KINDS.has(kind)) return noContent();

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const { count } = await db
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("day_kst", today);
  if ((count ?? 0) >= DAILY_EVENT_CAP) return noContent();

  if (kind === "visit") {
    const landing =
      typeof body.landing === "string" && LANDINGS.has(body.landing) ? body.landing : "other";
    const src = normSource(body.src) ?? { kind: "direct", value: "direct" };
    const ft = normSource(body.ft) ?? src;
    await db.from("analytics_events").insert({
      client_id: clientId,
      kind: "visit",
      landing,
      src_kind: src.kind,
      src_value: src.value,
      ft_kind: ft.kind,
      ft_value: ft.value,
    });
    // 기기 레지스트리(영구) — 최초행은 first-touch 동결, 이후는 last_seen 만 전진.
    const { error: insertError } = await db.from("analytics_devices").insert({
      client_id: clientId,
      first_seen_day: today,
      last_seen_day: today,
      first_landing: landing,
      ft_kind: ft.kind,
      ft_value: ft.value,
    });
    if (insertError) {
      await db
        .from("analytics_devices")
        .update({ last_seen_day: today })
        .eq("client_id", clientId)
        .lt("last_seen_day", today);
    }
  } else {
    await db.from("analytics_events").insert({ client_id: clientId, kind: "generate_view" });
    await db
      .from("analytics_devices")
      .update({ first_generate_view_day: today })
      .eq("client_id", clientId)
      .is("first_generate_view_day", null);
  }
  return noContent();
}
