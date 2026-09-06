// 사이트 ops 라우트 호출 — 바뀐 것만 지우는 정밀 무효화. SITE_URL·OPS_SECRET 이 없으면 건너뛴다(로컬 시험용).
import { log, warn } from "./log.mjs";

export async function revalidate(changeSet) {
  const site = process.env.SITE_URL;
  const secret = process.env.OPS_SECRET;
  if (!site || !secret) {
    warn("revalidate skipped (SITE_URL/OPS_SECRET unset)");
    return null;
  }
  const body = { paths: [...changeSet.paths], tags: [...changeSet.tags] };
  try {
    const res = await fetch(`${site}/api/ops/revalidate`, {
      method: "POST",
      headers: { "x-cron-secret": secret, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    log(`revalidate: ${res.status} ${text.slice(0, 120)} (sent ${body.paths.length} paths, ${body.tags.length} tags)`);
    return res.status;
  } catch (e) {
    warn(`revalidate failed (non-fatal): ${e}`);
    return null;
  }
}
