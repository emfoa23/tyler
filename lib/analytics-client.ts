// 방문·이용 통계 클라이언트 수집(집계 전용) — boss-paegi acquisition 로직의 축소 이식.
// 방문(탭 세션당 1회)·생성기 진입(탭 세션당 1회)을 /api/track 으로 best-effort 전송한다.
// IP·UA·원본 URL 은 보내지 않는다: 랜딩 그룹 + 정규화된 소스(도메인/utm_source)만.
// 클라이언트 전용. 실패는 조용히 무시(수집이 서비스 동작에 영향 주지 않음).
import { getClientId } from "@/lib/client-id";

// 검색엔진 렌더링 크롤러(Googlebot WRS·네이버 Yeti 등)는 JS 를 실행해 비콘을 울린다 —
// 페이지당 새 컨텍스트(새 client_id·direct·단발)로 방문 통계를 오염시키므로 발화 전에 거른다.
// UA 는 판별에만 쓰고 저장하지 않는다(무저장 원칙 유지).
const BOT_UA_RE =
  /bot|spider|crawl|slurp|headless|lighthouse|preview|yeti|daum|petal|semrush|ahrefs|yandex|baidu|bytespider|gptbot|inspectiontool|googleother|google-extended|facebookexternalhit|kakaotalk-scrap|whatsapp|telegram|skype/i;

export function isLikelyBot(): boolean {
  try {
    return navigator.webdriver === true || BOT_UA_RE.test(navigator.userAgent);
  } catch {
    return false;
  }
}

const FT_KEY = "tyler_ft"; // first-touch 소스 {k,v,ts} — 90일 sticky
const FT_TTL_MS = 90 * 86400_000;
const SESSION_VISIT_KEY = "tyler_v";
const SESSION_GENERATE_VIEW_KEY = "tyler_gv";

export type Source = { kind: "direct" | "referrer" | "utm" | "viral"; value: string };

export const LANDING_GROUPS = [
  "home",
  "generate",
  "history",
  "stores",
  "numbers",
  "share",
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
  // 자랑하기 링크 착지 = viral(레퍼러가 아닌 랜딩 경로 판정 — 인앱 브라우저의 레퍼러 소실 무관)
  if (location.pathname === "/share" || location.pathname.startsWith("/share/")) {
    return { kind: "viral", value: "share" };
  }
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
        (saved.k === "direct" || saved.k === "referrer" || saved.k === "utm" || saved.k === "viral") &&
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

// ── 상호작용 게이트(2026-08-29) ───────────────────────────────────────────────
// 신분을 밝히지 않는 렌더링 크롤러가 UA 게이트를 통과해 방문을 오염시켰다(08시 21기기 배치 실측).
// 사람의 결정적 판별자는 상호작용 — 첫 터치/스크롤/키 입력 "후"에만 큐에 쌓인 이벤트를 전송한다.
// 렌더 후 떠나는 봇은 상호작용이 없어 아무것도 보내지 않는다. 트레이드오프: 아무 조작 없이
// 이탈하는 진짜 바운스도 미집계(방문 = "상호작용한 방문"으로 정의 — 어드민 캡션에 명시).
const INTERACTED_KEY = "tyler_touched";
let pendingQueue: Record<string, unknown>[] = [];
let listenersArmed = false;

function hasInteracted(): boolean {
  try {
    return sessionStorage.getItem(INTERACTED_KEY) === "1";
  } catch {
    return false;
  }
}

function onFirstInteraction(): void {
  try {
    sessionStorage.setItem(INTERACTED_KEY, "1");
  } catch {
    // ignore
  }
  const queued = pendingQueue;
  pendingQueue = [];
  for (const body of queued) send(body);
}

function armInteractionListeners(): void {
  if (listenersArmed) return;
  listenersArmed = true;
  const fire = () => {
    for (const t of ["pointerdown", "keydown", "scroll", "touchstart"] as const) {
      window.removeEventListener(t, fire);
    }
    onFirstInteraction();
  };
  for (const t of ["pointerdown", "keydown", "scroll", "touchstart"] as const) {
    window.addEventListener(t, fire, { passive: true });
  }
}

function post(body: Record<string, unknown>): void {
  if (hasInteracted()) {
    send(body);
    return;
  }
  pendingQueue.push(body);
  armInteractionListeners();
}

function send(body: Record<string, unknown>): void {
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
    if (isLikelyBot()) return;
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
    if (isLikelyBot()) return;
    if (sessionStorage.getItem(SESSION_GENERATE_VIEW_KEY)) return;
    sessionStorage.setItem(SESSION_GENERATE_VIEW_KEY, "1");
    post({ clientId: getClientId(), kind: "generate_view" });
  } catch {
    // ignore
  }
}

/** 자랑하기 실행 — share(웹 공유 완료)/share_download(폴백). 클릭 기반이라 상호작용 게이트는 이미 통과. */
export function trackShare(kind: "share" | "share_download", drawNo: number): void {
  try {
    if (isLikelyBot()) return;
    post({ clientId: getClientId(), kind, drawNo });
  } catch {
    // ignore
  }
}
