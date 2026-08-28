import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  adminCookieToken,
  checkAdminSecret,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// 운영자 로그인 — 시크릿 일치 시 세션 쿠키(HttpOnly) 발급. 실패는 상수 지연 후 401(추측 억제).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkAdminSecret(body.secret)) {
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = adminCookieToken();
  if (!token) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
}
