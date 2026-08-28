import { createHash, timingSafeEqual } from "node:crypto";

// 운영자 인증 — 가입 기능 없는 서비스의 어드민 게이트.
// ADMIN_SECRET(Vercel env)을 아는 운영자만 /admin 진입. 쿠키에는 원문이 아니라
// sha256(ADMIN_SECRET) 파생 토큰을 담는다(쿠키 유출 시에도 원문 비노출, 회전은 env 교체로).
export const ADMIN_COOKIE = "tyler_admin";
export const ADMIN_COOKIE_MAX_AGE = 30 * 86400; // 30일

export function adminCookieToken(): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(secret).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** 로그인 폼 입력이 ADMIN_SECRET 과 일치하는가(상수시간 비교). */
export function checkAdminSecret(input: unknown): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || typeof input !== "string" || !input) return false;
  return safeEqual(input, secret);
}

/** 쿠키 값이 유효한 세션 토큰인가. */
export function checkAdminCookie(value: string | undefined): boolean {
  const token = adminCookieToken();
  if (!token || !value) return false;
  return safeEqual(value, token);
}
