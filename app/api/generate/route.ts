import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { drawDateFor, targetDrawFor } from "@/lib/lotto";
import { getLatestDraw } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAILY_LIMIT = 200;
const MAX_BATCH = 5;

// 서버에서 생성해야 통계가 정직해진다 (클라이언트 조작 번호가 기록되지 않도록).
function generateSet(): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const rand = new Uint32Array(6);
  crypto.getRandomValues(rand);
  const picked: number[] = [];
  for (let i = 0; i < 6; i++) {
    const idx = rand[i] % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const count = Math.min(Math.max(1, Number(body.count) || 1), MAX_BATCH);
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const latest = await getLatestDraw();
  if (!latest) {
    return NextResponse.json({ error: "데이터 준비 중입니다." }, { status: 503 });
  }
  const target = targetDrawFor(new Date(), latest);

  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count: used, error: countError } = await db
    .from("generated_sets")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", since);
  if (countError) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if ((used ?? 0) + count > DAILY_LIMIT) {
    return NextResponse.json(
      { error: "오늘 생성 한도(200세트)에 도달했습니다. 내일 다시 시도해주세요." },
      { status: 429 },
    );
  }

  const rows = Array.from({ length: count }, () => ({
    client_id: clientId,
    numbers: generateSet(),
    target_draw: target,
  }));
  const { data, error } = await db
    .from("generated_sets")
    .insert(rows)
    .select("id, numbers, target_draw, matched_rank, checked_at, created_at");
  if (error) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    targetDraw: target,
    targetDate: drawDateFor(latest, target),
    sets: data,
  });
}

export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get("clientId") ?? "";
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const latest = await getLatestDraw();

  const { data: sets, error } = await db
    .from("generated_sets")
    .select("id, numbers, target_draw, matched_rank, checked_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }

  const targets = [...new Set((sets ?? []).map((s) => s.target_draw))];
  const { data: draws } = targets.length
    ? await db
        .from("draws")
        .select("draw_no, draw_date, n1, n2, n3, n4, n5, n6, bonus")
        .in("draw_no", targets)
    : { data: [] };

  const { data: stats } = await db.rpc("generation_stats").single();

  const nextTarget = latest ? targetDrawFor(new Date(), latest) : null;
  return NextResponse.json({
    sets: sets ?? [],
    draws: Object.fromEntries((draws ?? []).map((d) => [d.draw_no, d])),
    stats: stats ?? null,
    nextTarget,
    nextTargetDate: latest && nextTarget ? drawDateFor(latest, nextTarget) : null,
  });
}
