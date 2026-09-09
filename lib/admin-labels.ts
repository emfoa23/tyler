// 운영 통계 표기 단일 소스 — 소스(kind·value)·랜딩 그룹·이벤트 종류의 한글 라벨.
// 집계 섹션(admin-sections)과 원본 이벤트 뷰어(admin-event-list)가 함께 쓴다. 한 개념 한 용어.

export const SRC_KO: Record<string, string> = {
  direct: "직접",
  referrer: "레퍼러",
  utm: "UTM",
  viral: "공유 링크",
};

export const LANDING_KO: Record<string, string> = {
  home: "홈",
  generate: "번호 생성",
  history: "당첨 결과",
  stores: "명당 순위",
  numbers: "번호 통계",
  share: "자랑 페이지",
  about: "서비스 소개",
  privacy: "개인정보처리방침",
  other: "기타",
};

/** analytics_events.kind — 표시 순서 = 필터 순서. */
export const EVENT_KINDS = ["visit", "generate_view", "check", "share"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const KIND_KO: Record<EventKind, string> = {
  visit: "방문",
  generate_view: "생성기 진입",
  check: "당첨 확인",
  share: "자랑 실행",
};

export function isEventKind(v: unknown): v is EventKind {
  return typeof v === "string" && (EVENT_KINDS as readonly string[]).includes(v);
}

/** "kind · value" 또는 "kind" 키를 한글 라벨로. direct/viral 은 값 생략. */
export function srcLabel(key: string): string {
  const [kind, value] = key.split(" · ");
  if (!kind) return "—";
  const k = SRC_KO[kind] ?? kind;
  if (!value || kind === "direct" || kind === "viral") return k;
  return `${k} · ${value}`;
}

export function landingLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return LANDING_KO[v] ?? v;
}
