import { db } from "@/lib/db";

// 운영 통계 데이터 접근 — 서버 전용(db 가 service role). 클라이언트 컴포넌트에서 import 금지.
//
// 하이브리드 규약(boss-paegi v1.06 이식): [오늘|7일|30일|전체] KST 달력일 윈도우.
// day-additive 지표(카운트류) = 롤업(day_kst < 오늘) + 오늘 라이브(analytics_rollup_rows_for_day)
// — 하루치 집계 SQL 함수가 cron 과 라이브의 단일 소스라 두 경로가 드리프트할 수 없다.
// 윈도우 distinct 기기·리텐션·성적표 = raw 직조회 RPC(일단위 분해가 안 되는 지표의 정직한 예외).

export type StatWindow = 1 | 7 | 30 | "all";

export function parseStatWindow(raw: string | undefined): StatWindow {
  if (raw === "today") return 1;
  if (raw === "30") return 30;
  if (raw === "all") return "all";
  return 7;
}

export function statWindowParam(window: StatWindow): string {
  if (window === 1) return "today";
  if (window === "all") return "all";
  return String(window);
}

export const STAT_WINDOW_TABS: readonly { window: StatWindow; label: string }[] = [
  { window: 1, label: "오늘" },
  { window: 7, label: "7일" },
  { window: 30, label: "30일" },
  { window: "all", label: "전체" },
];

export function statWindowLabel(window: StatWindow): string {
  if (window === 1) return "오늘(KST, 실시간)";
  if (window === "all") return "전체 기간";
  return `최근 ${window}일(KST 자정 기준)`;
}

/** KST 기준 offsetDays 일 전 날짜(YYYY-MM-DD). */
export function kstDate(offsetDays = 0): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  kst.setUTCDate(kst.getUTCDate() - offsetDays);
  return kst.toISOString().slice(0, 10);
}

function windowDays(window: StatWindow): number | null {
  return window === "all" ? null : window;
}

export type MetricRow = { metric: string; dim1: string; dim2: string; value: number };

type RawMetricRow = { metric: string; dim1: string; dim2: string; value: number | string };

function toMetricRow(r: RawMetricRow): MetricRow {
  return { metric: r.metric, dim1: r.dim1 ?? "", dim2: r.dim2 ?? "", value: Number(r.value) || 0 };
}

/** 윈도우 day-additive 지표 = 롤업(어제까지) + 오늘 라이브. PostgREST 기본 1,000행 제한 회피 페이징. */
export async function fetchWindowMetrics(window: StatWindow): Promise<MetricRow[]> {
  const today = kstDate(0);
  const rollup: RawMetricRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    let q = db
      .from("analytics_rollups")
      .select("metric,dim1,dim2,value")
      .lt("day_kst", today);
    if (window !== "all") q = q.gte("day_kst", kstDate(window - 1));
    const { data, error } = await q
      .order("day_kst", { ascending: true })
      .order("metric", { ascending: true })
      .order("dim1", { ascending: true })
      .order("dim2", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`analytics_rollups: ${error.message}`);
    rollup.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const live = await db.rpc("analytics_rollup_rows_for_day", { p_day: today });
  if (live.error) throw new Error(`rows_for_day: ${live.error.message}`);
  return [...rollup, ...((live.data ?? []) as RawMetricRow[])].map(toMetricRow);
}

export function metricTotal(rows: MetricRow[], metric: string): number {
  return rows.reduce((s, r) => (r.metric === metric ? s + r.value : s), 0);
}

/** dim1(+dim2) 별 합산 → value desc 정렬. */
export function metricByDim(rows: MetricRow[], metric: string): { key: string; value: number }[] {
  const agg = new Map<string, number>();
  for (const r of rows) {
    if (r.metric !== metric) continue;
    const key = r.dim2 ? `${r.dim1} · ${r.dim2}` : r.dim1;
    agg.set(key, (agg.get(key) ?? 0) + r.value);
  }
  return [...agg.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}

async function rpcRows<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (data ?? []) as T[];
}

export type FunnelStages = Record<string, number>;

/** 퍼널(윈도우 distinct 기기): visit→generate_view→generated→checked(당첨 확인) + multi_draw(2회차+). */
export async function getFunnelWindow(window: StatWindow): Promise<FunnelStages> {
  const rows = await rpcRows<{ stage: string; devices: number | string }>("admin_funnel_window", {
    p_days: windowDays(window),
  });
  const out: FunnelStages = {};
  for (const r of rows) out[r.stage] = Number(r.devices) || 0;
  return out;
}

export async function getReturningVisitDevices(window: StatWindow): Promise<number> {
  const rows = await rpcRows<{ metric: string; devices: number | string }>(
    "admin_engagement_window",
    { p_days: windowDays(window) },
  );
  return Number(rows.find((r) => r.metric === "returning_visit_devices")?.devices) || 0;
}

export type FtConversionRow = {
  ft_kind: string;
  ft_value: string;
  devices: number;
  gen_devices: number;
  check_devices: number;
};

/** first-touch 소스별 신규 기기 획득 → 생성/확인 도달(기기 레지스트리 — 영구 정확). */
export async function getFtConversion(window: StatWindow): Promise<FtConversionRow[]> {
  const rows = await rpcRows<Record<string, unknown>>("acq_ft_conversion", {
    p_days: windowDays(window),
  });
  return rows.map((r) => ({
    ft_kind: String(r.ft_kind ?? ""),
    ft_value: String(r.ft_value ?? ""),
    devices: Number(r.devices) || 0,
    gen_devices: Number(r.gen_devices) || 0,
    check_devices: Number(r.check_devices) || 0,
  }));
}

export type RetentionRow = {
  cohort_draw: number;
  devices: number;
  again_any: number;
  plus1: number;
  plus2: number;
  plus3: number;
};

/** 회차 코호트 리텐션(첫 참여 회차 기준, 전 기간 — generated_sets 영구라 정확). */
export async function getDrawRetention(cohorts = 8): Promise<RetentionRow[]> {
  const rows = await rpcRows<Record<string, unknown>>("gen_draw_retention", {
    p_cohorts: cohorts,
  });
  return rows.map((r) => ({
    cohort_draw: Number(r.cohort_draw) || 0,
    devices: Number(r.devices) || 0,
    again_any: Number(r.again_any) || 0,
    plus1: Number(r.plus1) || 0,
    plus2: Number(r.plus2) || 0,
    plus3: Number(r.plus3) || 0,
  }));
}

export type DrawReportRow = {
  draw_no: number;
  participants: number;
  sets: number;
  checked_sets: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  post_check_devices: number;
};

/** 회차별 성적표 + 추첨 후 7일 내 결과 확인 기기. */
export async function getDrawReport(draws = 8): Promise<DrawReportRow[]> {
  const rows = await rpcRows<Record<string, unknown>>("gen_draw_report", { p_draws: draws });
  return rows.map((r) => ({
    draw_no: Number(r.draw_no) || 0,
    participants: Number(r.participants) || 0,
    sets: Number(r.sets) || 0,
    checked_sets: Number(r.checked_sets) || 0,
    r1: Number(r.r1) || 0,
    r2: Number(r.r2) || 0,
    r3: Number(r.r3) || 0,
    r4: Number(r.r4) || 0,
    r5: Number(r.r5) || 0,
    post_check_devices: Number(r.post_check_devices) || 0,
  }));
}

const DEPTH_ORDER = ["1", "2-5", "6-20", "21-100", "101+"];

/** 기기당 생성 세트수 분포(윈도우). */
export async function getDeviceDepth(window: StatWindow): Promise<{ key: string; value: number }[]> {
  const rows = await rpcRows<{ bucket: string; devices: number | string }>("gen_device_depth", {
    p_days: windowDays(window),
  });
  return rows
    .map((r) => ({ key: r.bucket, value: Number(r.devices) || 0 }))
    .sort((a, b) => DEPTH_ORDER.indexOf(a.key) - DEPTH_ORDER.indexOf(b.key));
}

export type NumberFrequencyRow = { num: number; cnt: number };

/** 생성 번호 균등성(전 기간) — 서버 랜덤 공정성 점검. */
export async function getGeneratedNumberFrequency(): Promise<NumberFrequencyRow[]> {
  const rows = await rpcRows<{ num: number | string; cnt: number | string }>(
    "generated_number_frequency",
    {},
  );
  return rows.map((r) => ({ num: Number(r.num) || 0, cnt: Number(r.cnt) || 0 }));
}

export type ViralLoop = Record<string, number>;

/** 바이럴 루프(윈도우 distinct 기기): 자랑 실행 → viral 획득 신규 기기 → 그중 생성 도달. */
export async function getViralLoop(window: StatWindow): Promise<ViralLoop> {
  const rows = await rpcRows<{ metric: string; devices: number | string }>("admin_viral_loop", {
    p_days: windowDays(window),
  });
  const out: ViralLoop = {};
  for (const r of rows) out[r.metric] = Number(r.devices) || 0;
  return out;
}
