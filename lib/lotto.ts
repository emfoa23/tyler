import type { Draw, DrawNumbers, Store } from "./types";

// 온라인 판매 채널(동행복권 사이트). 배출점 데이터에 지점처럼 포함되며,
// 순위·지점 페이지에도 예외 없이 포함하되 배지로만 구분한다 (2026-08-16 확정).
export const ONLINE_STORE_ID = "51100000";

// 동행복권 표준 번호 구간 색
const BALL_COLORS = ["#fbc400", "#69c8f2", "#ff7272", "#aaaaaa", "#b0d840"];

export function ballColor(n: number): string {
  return BALL_COLORS[Math.min(Math.ceil(n / 10), 5) - 1];
}

export function drawNumbers(d: DrawNumbers): number[] {
  return [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];
}

export function matchRank(numbers: number[], draw: DrawNumbers): number {
  const wins = new Set(drawNumbers(draw));
  const m = numbers.filter((n) => wins.has(n)).length;
  if (m === 6) return 1;
  if (m === 5) return numbers.includes(draw.bonus) ? 2 : 3;
  if (m === 4) return 4;
  if (m === 3) return 5;
  return 0;
}

export function matchedNumbers(numbers: number[], draw: DrawNumbers): Set<number> {
  const wins = new Set([...drawNumbers(draw), draw.bonus]);
  return new Set(numbers.filter((n) => wins.has(n)));
}

const WEEK_MS = 7 * 86400_000;

function drawMoment(dateIso: string): number {
  // 추첨은 매주 토요일 20:35 KST
  return new Date(`${dateIso}T20:35:00+09:00`).getTime();
}

// 생성 시점이 귀속될 회차: 아직 추첨되지 않은 다음 회차.
// DB 동기화 상태가 아니라 추첨 시각 기준으로 계산한다 — 추첨 후 생성된 번호가
// 지난 회차에 대조되면 통계가 왜곡되기 때문 (2026-08-16 확정).
export function targetDrawFor(now: Date, latest: Pick<Draw, "draw_no" | "draw_date">): number {
  const diff = now.getTime() - drawMoment(latest.draw_date);
  if (diff <= 0) return latest.draw_no;
  return latest.draw_no + Math.floor(diff / WEEK_MS) + 1;
}

export function drawDateFor(latest: Pick<Draw, "draw_no" | "draw_date">, drawNo: number): string {
  const t = drawMoment(latest.draw_date) + (drawNo - latest.draw_no) * WEEK_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export const RANK_LABEL: Record<number, string> = {
  0: "낙첨", 1: "1등", 2: "2등", 3: "3등", 4: "4등", 5: "5등",
};

export function methodLabel(method: string | null): string | null {
  if (method === "Q") return "자동";
  if (method === "M") return "수동";
  if (method === "B") return "반자동"; // 1000회 1등 반자동 1건으로 실측 확인
  return method;
}

// 합산 행의 구매방식 병기: "자동 2 · 수동 1" (1명이면 수량 생략)
export function methodSummary(methods: Map<string, number>): string {
  return [...methods].map(([m, c]) => (c > 1 ? `${m} ${c}` : m)).join(" · ");
}

// 회차의 1등 구매유형 요약: "자동 10 · 수동 12 · 반자동 1" — 0건 유형은 생략,
// 전부 0(공개 전·데이터 없는 구회차)이면 null (sync 가 합계 0 을 null 로 정규화).
export function firstTypeSummary(
  draw: Pick<Draw, "first_auto" | "first_manual" | "first_semi">,
): string | null {
  const parts = ([["Q", draw.first_auto], ["M", draw.first_manual], ["B", draw.first_semi]] as const)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([m, n]) => `${methodLabel(m)} ${n}`);
  return parts.length ? parts.join(" · ") : null;
}

export function isOnlineStore(storeId: string): boolean {
  return storeId === ONLINE_STORE_ID;
}

// 온라인 채널의 원본 명칭은 "인터넷 복권판매사이트" — 표기는 "동행복권 사이트"로 통일.
export function storeDisplayName(store: Pick<Store, "store_id" | "name">): string {
  return isOnlineStore(store.store_id) ? "동행복권 사이트" : store.name;
}

// 기간 필터 공통 옵션 (명당 순위·번호 통계) — URL/RPC 는 월 단위
export const MONTHS_OPTIONS = [
  { value: "all", label: "전체 기간" },
  { value: "6", label: "최근 6개월" },
  { value: "12", label: "최근 1년" },
  { value: "60", label: "최근 5년" },
];

export const SIDO_LIST = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 시도 정식 명칭 — 검색 표기(title/description)용. UI 는 짧은 이름(SIDO_LIST)을 쓴다.
export const SIDO_FULL_NAME: Record<string, string> = {
  서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시", 광주: "광주광역시",
  대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시", 경기: "경기도", 강원: "강원특별자치도",
  충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도",
  경남: "경상남도", 제주: "제주특별자치도",
};
