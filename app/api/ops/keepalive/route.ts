import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/ops";

export const dynamic = "force-dynamic";

// cron-job.org 가 일 1회 호출 — Supabase 무료 프로젝트의 무활동 pause 방지용 DB 터치.
export async function GET(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { count, error } = await db
    .from("draws")
    .select("*", { count: "exact", head: true });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draws: count, at: new Date().toISOString() });
}
