import type {
  DrawReportRow,
  Engagement,
  FtConversionRow,
  FunnelStages,
  MetricRow,
  RetentionRow,
  StatWindow,
} from "@/lib/admin-analytics";
import { metricByDim, metricTotal } from "@/lib/admin-analytics";

// 운영 통계 표시 컴포넌트(서버) — 차트 라이브러리 없이 카드·CSS 바·테이블.
// 사이트 톤(white/stone/amber) 유지. 넓은 테이블은 overflow-x-auto(375px 무깨짐 규칙).

const SRC_KO: Record<string, string> = { direct: "직접", referrer: "레퍼러", utm: "UTM", viral: "공유 링크" };
const LANDING_KO: Record<string, string> = {
  home: "홈",
  generate: "번호 생성",
  history: "당첨 결과",
  stores: "명당 순위",
  numbers: "번호 통계",
  about: "서비스 소개",
  privacy: "개인정보처리방침",
  other: "기타",
};

function srcLabel(key: string): string {
  const [kind, value] = key.split(" · ");
  // first-touch 미상(기기 행이 서버 적재로 먼저 생긴 경우) — 빈 칸 대신 명시
  if (!kind) return "미상";
  const k = SRC_KO[kind] ?? kind;
  if (!value || kind === "direct" || kind === "viral") return k;
  return `${k} · ${value}`;
}

const nf = (n: number) => n.toLocaleString();
const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");

/** 표 안 "개수 + 비율" 단일 표기 — 개수가 주, 비율은 작은 보조 텍스트. */
function Ratio({ num, den }: { num: number; den: number }) {
  return (
    <>
      {nf(num)}
      <span className="ml-1 text-[10px] text-stone-400">{pct(num, den)}</span>
    </>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">{children}</div>;
}

export function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <h2 className="font-bold">
      {title} {note && <span className="text-xs font-normal text-stone-400">{note}</span>}
    </h2>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-amber-600">{sub}</p>}
    </div>
  );
}

function BarList({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
  const shown = items.filter((r) => r.value > 0);
  if (!shown.length) return <p className="text-sm text-stone-400">{empty}</p>;
  const max = Math.max(...shown.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {shown.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate text-stone-500">{r.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-stone-100">
            <div
              className="h-full rounded bg-amber-400/70"
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{nf(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 퍼널 ── */

export function FunnelSection({ stages }: { stages: FunnelStages }) {
  // 생성기 진입(generate_view)은 방문과 변별력이 낮아 퍼널에서 제외(2026-08-29 사용자 결정)
  // — 수집·롤업은 유지(유입 참고용), 표시만 4단계.
  const steps = [
    { key: "visit", label: "방문 기기" },
    { key: "generated", label: "번호 생성" },
    { key: "checked", label: "당첨 확인" },
    { key: "multi_draw", label: "2회차+ 생성" },
  ];
  return (
    <Card>
      <SectionTitle title="퍼널" note="기기 기준 · 전환율은 이전 단계 대비" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => {
          const value = stages[s.key] ?? 0;
          const prev = i > 0 ? (stages[steps[i - 1].key] ?? 0) : 0;
          // 수집 시작 전 과거가 섞인 '전체' 등에서 이전 단계보다 크면 전환율이 무의미 — 표시 생략.
          const rate = i > 0 && prev > 0 && value <= prev ? pct(value, prev) : undefined;
          return <StatCard key={s.key} label={s.label} value={nf(value)} sub={rate} />;
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-400">
        기기 = 브라우저별 익명 식별자(사람 수와 다를 수 있음). 방문 = 첫 터치·스크롤 등
        상호작용이 있었던 방문. 당첨 확인 = &lsquo;당첨만 보기&rsquo;를 눌러 이미 추첨이 끝난
        참여 회차의 결과를 본 기기. 2회차+ = 윈도우 내 생성 기기 중 서로 다른 회차 2개 이상
        참여.
      </p>
    </Card>
  );
}

/* ── 유입 ── */

export function AcquisitionSection({
  metrics,
  ft,
}: {
  metrics: MetricRow[];
  ft: FtConversionRow[];
}) {
  const bySrc = metricByDim(metrics, "visit_by_src")
    .slice(0, 10)
    .map((r) => ({ label: srcLabel(r.key), value: r.value }));
  const byLanding = metricByDim(metrics, "visit_by_landing").map((r) => ({
    label: LANDING_KO[r.key] ?? r.key,
    value: r.value,
  }));
  const ftShown = ft.filter((r) => r.devices > 0).slice(0, 10);
  return (
    <Card>
      <SectionTitle title="유입" note="방문(탭 세션 단위) · 소스는 정규화된 도메인/UTM" />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-stone-500">소스별 방문</p>
          <BarList items={bySrc} empty="아직 방문 데이터가 없어요." />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-stone-500">랜딩 페이지별 방문</p>
          <BarList items={byLanding} empty="아직 방문 데이터가 없어요." />
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-stone-500">
          최초 유입(first-touch)별 신규 기기 → 생성·당첨 확인 도달
        </p>
        {ftShown.length === 0 ? (
          <p className="text-sm text-stone-400">아직 신규 기기 데이터가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-stone-400">
                  <th className="py-1 pr-3 font-medium">소스</th>
                  <th className="px-3 py-1 text-right font-medium">신규 기기</th>
                  <th className="px-3 py-1 text-right font-medium">생성 도달</th>
                  <th className="px-3 py-1 text-right font-medium">당첨 확인</th>
                </tr>
              </thead>
              <tbody>
                {ftShown.map((r) => (
                  <tr key={`${r.ft_kind}·${r.ft_value}`} className="border-t border-stone-100">
                    <td className="py-1.5 pr-3 text-stone-600">
                      {srcLabel(r.ft_value ? `${r.ft_kind} · ${r.ft_value}` : r.ft_kind)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">{nf(r.devices)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Ratio num={r.gen_devices} den={r.devices} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Ratio num={r.check_devices} den={r.devices} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── 바이럴 루프 ── */

export function ViralLoopSection({
  metrics,
  stages,
  loop,
}: {
  metrics: MetricRow[];
  stages: FunnelStages;
  loop: Record<string, number>;
}) {
  const shareCount = metricTotal(metrics, "share_actions");
  const checked = stages.checked ?? 0;
  const shareDevices = loop.share_devices ?? 0;
  const viralNew = loop.viral_new_devices ?? 0;
  const viralGen = loop.viral_gen_devices ?? 0;
  return (
    <Card>
      <SectionTitle title="바이럴 루프" note="당첨 확인 → 자랑하기 → 공유 유입 → 생성" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="당첨 확인 기기" value={nf(checked)} />
        <StatCard
          label="자랑 실행 기기"
          value={nf(shareDevices)}
          sub={shareCount > 0 ? `실행 ${nf(shareCount)}회` : undefined}
        />
        <StatCard label="공유 유입 신규 기기" value={nf(viralNew)} />
        <StatCard label="그중 생성 도달" value={nf(viralGen)} sub={pct(viralGen, viralNew)} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-400">
        윈도우 집계 근사(인과 아님). 자랑 실행 = 공유 시트 완료(또는 미지원 폴백 저장). 공유
        유입은 /share 링크 랜딩 기준
        — 이미지 워터마크만 보고 직접 들어온 유입은 &lsquo;직접&rsquo;으로 잡혀요. 신규 기기
        귀속은 first-touch 기준.
      </p>
    </Card>
  );
}

/* ── 유저 구성 ── */

export function UserCompositionSection({
  window,
  metrics,
  stages,
  engagement,
  retention,
}: {
  window: StatWindow;
  metrics: MetricRow[];
  stages: FunnelStages;
  engagement: Engagement;
  retention: RetentionRow[];
}) {
  // GA식·일 단위(2026-09-02): 처음 = 첫 관측일(방문·생성 중 먼저)이 기간 안(롤업), 다시 = 기간 안에
  // 첫날보다 뒤의 방문일/생성일이 있음(raw RPC). 기간 안에서 처음 오고 또 온 기기는 둘 다에 세므로
  // 합이 전체보다 클 수 있다(오늘 탭만 겹침 없음, 전체 탭은 처음=전체). 방문·생성은 퍼널과 같은 값.
  // 카드 라벨은 4자(처음 방문·다시 방문·처음 생성·다시 생성) — 375px 3열에서 긴 라벨은 두 줄로 꺾임(실측).
  const rows = [
    {
      label: "방문 기기",
      total: stages.visit ?? 0,
      first: "처음 방문",
      firstValue: metricTotal(metrics, "visit_new_devices"),
      again: "다시 방문",
      againValue: engagement.returningVisitDevices,
      of: "방문",
    },
    {
      label: "생성 기기",
      total: stages.generated ?? 0,
      first: "처음 생성",
      firstValue: metricTotal(metrics, "gen_new_devices"),
      again: "다시 생성",
      againValue: engagement.returningGenDevices,
      of: "생성",
    },
  ];
  return (
    <Card>
      <SectionTitle title="유저 구성" note="기기 기준 · 처음/다시로 분해 · 겹칠 수 있어요" />
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-3 gap-2">
            <StatCard label={r.label} value={nf(r.total)} />
            <StatCard label={r.first} value={nf(r.firstValue)} />
            <StatCard
              label={r.again}
              value={nf(r.againValue)}
              sub={r.total > 0 ? `${r.of}의 ${pct(r.againValue, r.total)}` : undefined}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-400">
        처음 = 첫 관측일(방문·생성 중 먼저)이 기간 안. 다시 = 기간 안에 첫날보다 뒤의 방문일·생성일이
        있음. 기간 안에서 처음 오고 또 온 기기는 둘 다에 세므로 합이 전체보다 클 수 있어요(오늘 탭은 겹침
        없음).{window === "all" && " 전체 탭에서는 처음 방문·처음 생성이 전체와 같아요."}
      </p>
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-stone-500">
          회차 코호트 리텐션 <span className="font-normal">— 첫 참여 회차 기준, 전 기간</span>
        </p>
        {retention.length === 0 ? (
          <p className="text-sm text-stone-400">아직 생성 데이터가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-stone-400">
                  <th className="py-1 pr-3 font-medium">첫 참여</th>
                  <th className="px-3 py-1 text-right font-medium">기기</th>
                  <th className="px-3 py-1 text-right font-medium">2회차+</th>
                  <th className="px-3 py-1 text-right font-medium">5회차+</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((r) => (
                  <tr key={r.cohort_draw} className="border-t border-stone-100">
                    <td className="py-1.5 pr-3 text-stone-600">{r.cohort_draw}회</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{nf(r.devices)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Ratio num={r.again_any} den={r.devices} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Ratio num={r.deep5} den={r.devices} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1.5 text-xs text-stone-400">
          2회차+/5회차+ = 해당 코호트 기기 중 서로 다른 회차 2개/5개 이상 참여. 최신 회차
          코호트는 다음 추첨 전까지 재참여가 0으로 보이는 게 정상이에요.
        </p>
      </div>
    </Card>
  );
}

/* ── 생성분석 ── */

export function GenerationSection({
  metrics,
  stages,
  report,
  depth,
}: {
  metrics: MetricRow[];
  stages: FunnelStages;
  report: DrawReportRow[];
  depth: { key: string; value: number }[];
}) {
  const sets = metricTotal(metrics, "gen_sets");
  const genDevices = stages.generated ?? 0;

  // 생성 기기·처음 생성은 유저 구성 섹션(한 숫자 한 자리). 여기는 세트 단위만.
  return (
    <Card>
      <SectionTitle title="생성분석" note="서버 무작위 생성 · 당첨 대조 포함" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatCard label="생성 세트" value={nf(sets)} />
        <StatCard
          label="기기당 세트"
          value={genDevices > 0 ? (sets / genDevices).toFixed(1) : "—"}
        />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-stone-500">
          회차별 성적표 <span className="font-normal">— 확인 = &lsquo;당첨만 보기&rsquo;로 그 회차 결과를 본 기기 · 공유 = 자랑 실행 기기</span>
        </p>
        {report.length === 0 ? (
          <p className="text-sm text-stone-400">아직 생성 데이터가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-stone-400">
                  <th className="py-1 pr-3 font-medium">회차</th>
                  <th className="px-3 py-1 text-right font-medium">참여 기기</th>
                  <th className="px-3 py-1 text-right font-medium">세트</th>
                  <th className="px-3 py-1 text-right font-medium">5등</th>
                  <th className="px-3 py-1 text-right font-medium">4등</th>
                  <th className="px-3 py-1 text-right font-medium">3등+</th>
                  <th className="px-3 py-1 text-right font-medium">확인</th>
                  <th className="px-3 py-1 text-right font-medium">공유</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => {
                  const undrawn = r.checked_sets === 0;
                  return (
                    <tr key={r.draw_no} className="border-t border-stone-100">
                      <td className="py-1.5 pr-3 text-stone-600">
                        {r.draw_no}회{undrawn && <span className="ml-1 text-xs text-blue-500">추첨 전</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold">{nf(r.participants)}</td>
                      <td className="px-3 py-1.5 text-right">{nf(r.sets)}</td>
                      <td className="px-3 py-1.5 text-right">{undrawn ? "—" : nf(r.r5)}</td>
                      <td className="px-3 py-1.5 text-right">{undrawn ? "—" : nf(r.r4)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {undrawn ? "—" : nf(r.r1 + r.r2 + r.r3)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Ratio num={r.post_check_devices} den={r.participants} />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Ratio num={r.share_devices} den={r.participants} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-stone-500">기기당 생성 세트수 분포</p>
        <BarList
          items={depth.map((d) => ({ label: `${d.key}세트`, value: d.value }))}
          empty="아직 생성 데이터가 없어요."
        />
      </div>
    </Card>
  );
}
