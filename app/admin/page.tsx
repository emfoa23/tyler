import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import { ADMIN_COOKIE, checkAdminCookie } from "@/lib/admin-auth";
import {
  fetchWindowMetrics,
  getDeviceDepth,
  getDrawReport,
  getDrawRetention,
  getFtConversion,
  getFunnelWindow,
  getGeneratedNumberFrequency,
  getReturningVisitDevices,
  parseStatWindow,
  statWindowLabel,
} from "@/lib/admin-analytics";
import { AdminLogin } from "@/components/admin-login";
import { AdminPeriodTabs } from "@/components/admin-period-tabs";
import {
  AcquisitionSection,
  EngagementSection,
  FunnelSection,
  GenerationSection,
} from "@/components/admin-sections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  core: "운영 통계",
  description: "로또젠 운영 지표를 확인하세요",
  path: "/admin",
  noindex: true,
});

/**
 * 운영 통계(운영자 전용) — 퍼널·유입·유저활용·생성분석.
 * 하이브리드(boss-paegi v1.06 규약): 오늘=라이브(rows_for_day)·어제까지=일별 롤업.
 * 윈도우 distinct 기기·리텐션·성적표는 raw 직조회 RPC(일단위 분해 불가한 지표의 예외).
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const cookieStore = await cookies();
  if (!checkAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return <AdminLogin />;
  }

  const sp = await searchParams;
  const window = parseStatWindow(sp.days);

  const [metrics, stages, returning, ft, retention, report, depth, numFreq] = await Promise.all([
    fetchWindowMetrics(window),
    getFunnelWindow(window),
    getReturningVisitDevices(window),
    getFtConversion(window),
    getDrawRetention(8),
    getDrawReport(8),
    getDeviceDepth(window),
    getGeneratedNumberFrequency(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-xl font-bold">운영 통계</h1>
        <AdminPeriodTabs current={window} />
      </div>
      <p className="text-xs leading-relaxed text-stone-400">
        {statWindowLabel(window)} · 기기(브라우저) 기준. 오늘은 실시간, 어제까지는 일 단위 확정
        집계예요. 방문·진입·확인 수집은 2026-08-29 시작(그 전 과거는 비어 있음), 생성·리텐션은 전
        기간 정확해요.
      </p>

      <FunnelSection stages={stages} />
      <AcquisitionSection metrics={metrics} ft={ft} />
      <EngagementSection metrics={metrics} stages={stages} returning={returning} retention={retention} />
      <GenerationSection
        metrics={metrics}
        stages={stages}
        report={report}
        depth={depth}
        numFreq={numFreq}
      />
    </div>
  );
}
