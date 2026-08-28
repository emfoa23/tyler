// 방문·이용 통계 클라이언트 수집(집계 전용) — boss-paegi acquisition 로직의 축소 이식.
// 방문(탭 세션당 1회)·생성기 진입(탭 세션당 1회)을 /api/track 으로 best-effort 전송한다.
// IP·UA·원본 URL 은 보내지 않는다: 랜딩 그룹 + 정규화된 소스(도메인/utm_source)만.
// 클라이언트 전용. 실패는 조용히 무시(수집이 서비스 동작에 영향 주지 않음).
import { getClientId } from "@/lib/client-id";

const FT_KEY = "tyler_ft"; // first-touch 소스 {k,v,ts} — 90일 sticky
const FT_TTL_MS = 90 * 86400_000;
const SESSION_VISIT_KEY = "tyler_v";
const SESSION_GENERATE_VIEW_KEY = "tyler_gv";

export type Source = { kind: "direct" | "referrer" | "utm"; value: string };

export const LANDING_GROUPS = [
  "home",
  "generate",
  "history",
  "stores",
  "numbers",
  "about",
  "privacy",
  "other",
] as const;
export type LandingGroup = (typeof LANDING_GROUPS)[number];

export function landingGroupOf(pathname: string): LandingGroup {
  if (pathname === "/") return "home";
  const head = pathname.split("/")[1];
  return (LANDING_GROUPS as readonly string[]).includes(head) ? (head as LandingGroup) : "other";
}

// 소스 값 정규화 — 소문자·64자·의심값(이메일/쿼리 잔재) 배제. 부적합은 direct 로 강등.
function normalizeValue(raw: string): string | null {
  const v = raw.trim().toLowerCase().slice(0, 64);
  if (!v || v.includes("@") || v.includes("%40") || v.includes("?") || v.includes("=")) return null;
  return v;
}

export function currentSource(location: Location, referrer: string): Source {
  const utm = normalizeValue(new URLSearchParams(location.search).get("utm_source") ?? "");
  if (utm) return { kind: "utm", value: utm };
  try {
    if (referrer) {
      const host = new URL(referrer).hostname.toLowerCase();
      if (host && host !== location.hostname) {
        const v = normalizeValue(host);
        if (v) return { kind: "referrer", value: v };
      }
    }
  } catch {
    // referrer 파싱 실패 → direct
  }
  return { kind: "direct", value: "direct" };
}

export function firstTouchSource(current: Source): Source {
  try {
    const raw = localStorage.getItem(FT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { k?: string; v?: string; ts?: number };
      if (
        (saved.k === "direct" || saved.k === "referrer" || saved.k === "utm") &&
        typeof saved.v === "string" &&
        typeof saved.ts === "number" &&
        Date.now() - saved.ts < FT_TTL_MS
      ) {
        return { kind: saved.k, value: saved.v.slice(0, 64) };
      }
    }
    localStorage.setItem(
      FT_KEY,
      JSON.stringify({ k: current.kind, v: current.value, ts: Date.now() }),
    );
  } catch {
    // storage 불가 환경 — current 를 그대로 귀속
  }
  return current;
}

function post(body: Record<string, unknown>): void {
  try {
    void fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/** 탭 세션당 1회 — 랜딩 방문. */
export function trackVisit(pathname: string): void {
  try {
    if (sessionStorage.getItem(SESSION_VISIT_KEY)) return;
    sessionStorage.setItem(SESSION_VISIT_KEY, "1");
    const src = currentSource(window.location, document.referrer);
    const ft = firstTouchSource(src);
    post({
      clientId: getClientId(),
      kind: "visit",
      landing: landingGroupOf(pathname),
      src: { kind: src.kind, value: src.value },
      ft: { kind: ft.kind, value: ft.value },
    });
  } catch {
    // ignore
  }
}

/** 탭 세션당 1회 — 생성기 진입(랜딩이 아니어도 도달을 셈). */
export function trackGenerateView(): void {
  try {
    if (sessionStorage.getItem(SESSION_GENERATE_VIEW_KEY)) return;
    sessionStorage.setItem(SESSION_GENERATE_VIEW_KEY, "1");
    post({ clientId: getClientId(), kind: "generate_view" });
  } catch {
    // ignore
  }
}
