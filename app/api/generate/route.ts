import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { drawDateFor, targetDrawFor } from "@/lib/lotto";
import { getLatestDraw } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAILY_LIMIT = 200;
const MAX_BATCH = 5;

// 서버에서 생성해야 통계가 정직해진다 (클라이언트 조작 번호가 기록되지 않도록).
// 반자동: 실제 로또처럼 최대 5개까지 고정을 허용하고, 나머지는 여전히 서버 무작위.
function generateSet(fixed: number[] = []): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !fixed.includes(n));
  const need = 6 - fixed.length;
  const rand = new Uint32Array(need);
  crypto.getRandomValues(rand);
  const picked = [...fixed];
  for (let i = 0; i < need; i++) {
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

  const fixed: number[] = (Array.isArray(body.fixed) ? body.fixed : []).map(Number);
  const fixedValid =
    fixed.length <= 5 &&
    fixed.every((n) => Number.isInteger(n) && n >= 1 && n <= 45) &&
    new Set(fixed).size === fixed.length;
  if (!fixedValid) {
    return NextResponse.json({ error: "고정 번호가 잘못되었습니다." }, { status: 400 });
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
    numbers: generateSet(fixed),
    target_draw: target,
    fixed_count: fixed.length,
  }));
  const { data, error } = await db
    .from("generated_sets")
    .insert(rows)
    .select("id, numbers, target_draw, matched_rank, checked_at, created_at");
  if (error) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  // 기기 레지스트리(방문·이용 통계) — best-effort, 실패해도 생성 응답에 영향 없음.
  try {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const { error: regError } = await db.from("analytics_devices").insert({
      client_id: clientId,
      first_seen_day: today,
      last_seen_day: today,
      first_gen_day: today,
      last_gen_day: today,
    });
    if (regError) {
      await db
        .from("analytics_devices")
        .update({ last_gen_day: today })
        .eq("client_id", clientId);
      await db
        .from("analytics_devices")
        .update({ first_gen_day: today })
        .eq("client_id", clientId)
        .is("first_gen_day", null);
    }
  } catch {
    // 통계 실패 무시
  }

  return NextResponse.json({
    targetDraw: target,
    targetDate: drawDateFor(latest, target),
    sets: data,
  });
}

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  const beforeId = Number(url.searchParams.get("beforeId")) || null;
  // wins=1: 당첨(matched_rank ≥ 1)만 — 추첨 전(null)·낙첨(0) 제외. 총계(count)도 같은 조건.
  const winsOnly = url.searchParams.get("wins") === "1";
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const latest = await getLatestDraw();

  // id desc = 생성 시각 역순의 안정 전순서 (같은 배치의 created_at 동률에도 커서가 안 흔들린다)
  let query = db
    .from("generated_sets")
    .select("id, numbers, target_draw, matched_rank, checked_at, created_at", beforeId ? {} : { count: "exact" })
    .eq("client_id", clientId)
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (winsOnly) query = query.gt("matched_rank", 0);
  if (beforeId) query = query.lt("id", beforeId);
  const { data: sets, count: total, error } = await query;
  if (error) {
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }

  // '당첨 확인' 통계(집계 전용) — "당첨만 보기"를 눌러(wins=1) 이미 추첨이 끝난 참여 회차의
  // 결과를 본 기기만 적재(2026-08-29 사용자 확정 재정의 — 단순 목록 조회는 세지 않는다).
  // 추첨 완료 판정 = checked_at 있는 세트 보유(check_generated_sets 가 대조를 마친 참여).
  // **어느 회차를 봤는지(draw_no)까지 함께 적재** — 그 기기가 참여한 회차 중 대조가 끝난 가장
  // 최근 회차가 이 클릭으로 실제 결과가 보인 회차다(미대조 회차는 화면에 '추첨 전'으로 나온다).
  // 회차를 안 남기면 성적표가 날짜창으로 추정할 수밖에 없어 인접 회차 이중 계상·추첨 전 계상이
  // 생긴다(2026-08-29 실측) — 자랑하기(share)가 쓰는 draw_no 귀속과 같은 방식으로 통일.
  // 서버 적재(위조 방지)·첫 페이지만(페이지네이션 제외)·best-effort.
  if (!beforeId && winsOnly) {
    try {
      const { data: drawn } = await db
        .from("generated_sets")
        .select("target_draw")
        .eq("client_id", clientId)
        .not("checked_at", "is", null)
        .order("target_draw", { ascending: false })
        .limit(1);
      const checkedDraw = drawn?.[0]?.target_draw ?? null;
      if (checkedDraw !== null) {
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        await db
          .from("analytics_events")
          .insert({ client_id: clientId, kind: "check", draw_no: checkedDraw });
        await db
          .from("analytics_devices")
          .update({ first_check_day: today })
          .eq("client_id", clientId)
          .is("first_check_day", null);
      }
    } catch {
      // 통계 실패 무시
    }
  }

  const targets = [...new Set((sets ?? []).map((s) => s.target_draw))];
  const { data: draws } = targets.length
    ? await db
        .from("draws")
        .select("draw_no, draw_date, n1, n2, n3, n4, n5, n6, bonus")
        .in("draw_no", targets)
    : { data: [] };

  // 페이지 이어받기(beforeId) 응답에는 통계 생략 — 첫 로드 값을 클라이언트가 유지한다
  const { data: stats } = beforeId ? { data: null } : await db.rpc("generation_stats").single();

  const nextTarget = latest ? targetDrawFor(new Date(), latest) : null;
  return NextResponse.json({
    sets: sets ?? [],
    draws: Object.fromEntries((draws ?? []).map((d) => [d.draw_no, d])),
    total: total ?? null,
    stats: stats ?? null,
    nextTarget,
    nextTargetDate: latest && nextTarget ? drawDateFor(latest, nextTarget) : null,
  });
}
