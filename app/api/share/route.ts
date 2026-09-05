import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isBotUserAgent } from "@/lib/bot-ua";
import { getWinningSets } from "@/lib/queries";

export const dynamic = "force-dynamic";

// 자랑하기 공유 토큰 발급 — 공유 링크가 "그 기기의 해당 회차 당첨 내역" 페이지로 랜딩하게 한다.
// client_id 를 URL 에 노출하지 않기 위한 간접 참조. (기기, 회차) 당 1행 upsert 라 flood 불가.
// 당첨(matched_rank ≥ 1) 세트가 실제로 있는 회차만 발급(위조 자랑 방지).
// 응답에 당첨 세트도 함께 돌려준다 — 자랑 이미지가 착지 페이지와 같은 서버 순서(등수 → id)로 그리게
// (2026-09-05: 이미지는 화면에 로드된 세트를 최신순으로 쓰고 착지는 등수순이라 둘이 어긋났었다).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || isBotUserAgent(ua)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const drawNo = Number(body.drawNo);
  if (!UUID_RE.test(clientId) || !Number.isInteger(drawNo) || drawNo < 1 || drawNo > 9999) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const sets = await getWinningSets(clientId, drawNo);
  if (sets.length === 0) {
    return NextResponse.json({ error: "당첨 내역이 없습니다." }, { status: 404 });
  }

  const { data: existing } = await db
    .from("shares")
    .select("token")
    .eq("client_id", clientId)
    .eq("draw_no", drawNo)
    .maybeSingle();
  if (existing?.token) {
    return NextResponse.json({ token: existing.token, sets });
  }

  const token = randomUUID().replace(/-/g, "");
  const { error } = await db.from("shares").insert({ token, client_id: clientId, draw_no: drawNo });
  if (error) {
    // (기기, 회차) unique 경합 — 기존 행 재조회
    const { data: raced } = await db
      .from("shares")
      .select("token")
      .eq("client_id", clientId)
      .eq("draw_no", drawNo)
      .maybeSingle();
    if (raced?.token) return NextResponse.json({ token: raced.token, sets });
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  return NextResponse.json({ token, sets });
}
