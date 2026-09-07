import type { Draw, DrawNumbers, Store } from "./types";
import { WEEK_MS, drawMoment } from "./draw-time.mjs";

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
// 전부 0(공개 전·데이터 없는 구회차 — 원본 0 그대로 저장)이면 null. 공개 판정 규칙은 lib/draw-state.mjs.
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

// 번호 통계 2차 메뉴 — /numbers 는 섹션 루트이자 기본 뷰(자주 나오는 번호)
export const NUMBERS_TABS = [
  { href: "/numbers", label: "자주 나오는 번호" },
  { href: "/numbers/missing", label: "안나온 번호" },
  { href: "/numbers/together", label: "같이 나온 번호" },
];

// 명당 2차 메뉴 — /stores 는 섹션 루트이자 기본 뷰(명당 순위), 검색은 마스터 전체 지점 대상(2026-09-07)
export const STORES_TABS = [
  { href: "/stores", label: "명당 순위" },
  { href: "/stores/search", label: "판매점 검색" },
];

// 같이 나온 번호의 조건 번호(with=1,18) — 1~45 정수, 중복 제거, 오름차순
export function parseWith(raw: string | undefined): number[] {
  if (!raw) return [];
  const nums = raw.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  return [...new Set(nums)].sort((a, b) => a - b);
}

// 생성기 진입 파라미터(/generate?picked=1,18) 도 같은 규칙
export const parsePicked = parseWith;

// 고른 개수가 곧 생성 모드 — 생성기(/api/generate generateSet)와 같은 규칙. 0 은 자동(라벨 없음).
export function pickedModeLabel(count: number): string | null {
  if (count === 0) return null;
  if (count <= 5) return "반자동";
  if (count === 6) return "수동";
  return "내 번호만 뽑기";
}

// 안나온 번호 랭킹: 마지막 출현(last_draw) 이후 몇 회째 안 나왔는지 — 최신 회차 기준
// 내림차순. 기간 필터가 없는 이유: 미출현 회차수는 최신 회차에서 거슬러 세는 지표라
// 기간 윈도우와 개념이 충돌한다. 전 기간 무출현(last_draw null)은 최신 회차수 전체로 최상위.
export function rankByMissed<T extends { num: number; last_draw: number | null }>(
  rows: T[],
  latestNo: number,
): (T & { missed: number })[] {
  return rows
    .map((r) => ({ ...r, missed: latestNo - (r.last_draw ?? 0) }))
    .sort((a, b) => b.missed - a.missed || a.num - b.num);
}

// 표준 경쟁 순위(1,1,1,4) — 이미 정렬된 목록에서 key 가 앞 항목과 같으면 같은 순위, 다르면 index+1.
// 동률 판정 키는 그 목록의 정렬 키와 같아야 한다(자주 나오는 번호=출현 횟수, 안나온 번호=미출현 회차수).
// 명당 순위는 서버 페이징이라 클라이언트에서 계산할 수 없어 SQL rank() 가 준다(store_ranking.rnk).
export function withCompetitionRank<T>(rows: T[], key: (row: T) => number): (T & { rank: number })[] {
  let rank = 0;
  let prev: number | undefined;
  return rows.map((row, i) => {
    const k = key(row);
    if (k !== prev) {
      rank = i + 1;
      prev = k;
    }
    return { ...row, rank };
  });
}

// ── 기간 필터 (명당 순위·자주 나오는 번호 공통, 2026-09-07 사용자 확정 — 안나온·같이 나온 번호는 기간 없음) ──
// 단위는 회차 하나뿐이다 — Period = 최근 N회(null = 전체 기간). 달력(개월) 표현은 복잡도만 올려 두지 않는다.
// 회차는 1회부터 결번 없이 매주 이어져 draw_no 뺄셈이 정확하고, 그래서 최신 추첨일 앵커가 필요 없다.
// URL 은 draws=N, DB 함수는 p_draws 하나. 구 주소(months=·years=)는 회차로 환산해 받기만 한다(UI 에 없음).
export type Period = number | null;

export const PERIOD_PRESETS = [10, 30, 50];
export const PERIOD_OPTIONS = [
  { value: "all", label: "전체 기간" },
  ...PERIOD_PRESETS.map((n) => ({ value: String(n), label: `최근 ${n}회` })),
  { value: "custom", label: "직접 입력" },
];
export const PERIOD_MAX = 9999;

function positiveInt(raw: string | undefined): number | null {
  const n = Number(raw);
  return raw !== undefined && Number.isInteger(n) && n >= 1 && n <= PERIOD_MAX ? n : null;
}

// URL → Period. 구 months/years 링크는 회차로 환산(1개월 ≈ 4.35회 = 52.18주 ÷ 12) — 새 링크는 draws 만 만든다.
export function parsePeriod(params: { draws?: string; months?: string; years?: string }): Period {
  const draws = positiveInt(params.draws);
  if (draws) return draws;
  const years = positiveInt(params.years);
  const months = positiveInt(params.months) ?? (years ? years * 12 : null);
  return months ? Math.round(months * (52.18 / 12)) : null;
}

// Period → 셀렉트 값 ("all" | 프리셋 | "custom")
export function periodValue(period: Period): string {
  if (!period) return "all";
  return PERIOD_PRESETS.includes(period) ? String(period) : "custom";
}

// Period → URL 파라미터 (전체 기간은 없음)
export function periodParam(period: Period): string | null {
  return period ? `draws=${period}` : null;
}

// Period → DB 창. 최신 회차 이상은 전체 기간과 같으므로 null 로 정규화한다.
export function periodDraws(period: Period, latestNo: number): number | null {
  return period && period < latestNo ? period : null;
}

export const SIDO_LIST = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];
// 판매점 검색어 길이 — 서버(페이지 판정)와 클라이언트(입력칸)가 같은 값을 쓴다.
// ("use client" 모듈의 상수를 서버 컴포넌트가 import 하면 클라이언트 참조가 되어 숫자로 못 쓴다 — 그래서 여기.)
export const STORE_SEARCH_MIN = 2;
export const STORE_SEARCH_MAX = 30;
