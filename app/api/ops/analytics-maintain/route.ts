import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/ops";

export const dynamic = "force-dynamic";

// 방문·이용 통계 유지보수 — cron-job.org 가 KST 00:05 일 1회 호출(자정 직후 앵커:
// 어드민 하이브리드에서 자정을 넘은 '어제'가 롤업 관할로 넘어가는 경계를 봉인한다).
// ①maintain_analytics_rollups(3): 오늘 포함 3일 delete-재계산(멱등·advisory lock)
// ②성공 시 prune_analytics_events(90): raw 90일 보존. 롤업 실패 시 prune 미실행.
export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rollup = await db.rpc("maintain_analytics_rollups", { p_days: 3 });
  if (rollup.error || (rollup.data as { ok?: boolean } | null)?.ok !== true) {
    return NextResponse.json(
      { ok: false, error: rollup.error?.message ?? "rollup_failed" },
      { status: 500 },
    );
  }
  const prune = await db.rpc("prune_analytics_events", { p_retention_days: 90 });
  if (prune.error || (prune.data as { ok?: boolean } | null)?.ok !== true) {
    return NextResponse.json(
      { ok: false, error: prune.error?.message ?? "prune_failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, rollup: rollup.data, prune: prune.data });
}
