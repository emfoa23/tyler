import { timingSafeEqual } from "node:crypto";

// cron-job.org·GitHub Actions 가 호출하는 ops 라우트 공통 게이트 (boss-paegi 의 x-cron-secret 패턴).
export function checkCronSecret(req: Request): boolean {
  const secret = process.env.OPS_SECRET;
  const got = req.headers.get("x-cron-secret");
  if (!secret || !got) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
