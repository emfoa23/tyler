// 1회성 일괄 알림 — 사이트맵 인덱스에 실린 URL 전부를 IndexNow 로 보낸다(네이버·Bing 등 참여 엔진, 구글 제외).
// IndexNow 는 원래 "방금 바뀐 URL" 용이지만, 한 번도 알린 적 없는 기존 페이지(과거 회차·지점)의 존재를
// 알리기 위해 배포 직후 한 번 실행한다(2026-09-06). 이후 주간 변경분은 sync-draw/sync-stores 가 보낸다.
//   node scripts/indexnow-bulk.mjs                 # https://lottogen.click/sitemap.xml 기준
//   node scripts/indexnow-bulk.mjs --dry           # 보내지 않고 개수만
import { pingIndexNow } from "./lib/indexnow.mjs";
import { log } from "./lib/log.mjs";

const SITE = process.env.SITE_URL || "https://lottogen.click";
const dry = process.argv.includes("--dry");

async function fetchXml(url) {
  const res = await fetch(url, { headers: { "user-agent": "lottogen-indexnow-bulk" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

const index = await fetchXml(`${SITE}/sitemap.xml`);
const files = locs(index);
log(`sitemap index: ${files.length} files`);
const urls = [];
for (const f of files) {
  const u = locs(await fetchXml(f));
  log(`  ${f.split("/").pop()}: ${u.length} urls`);
  urls.push(...u);
}
const unique = [...new Set(urls)];
log(`total ${unique.length} urls${dry ? " (dry run — not sent)" : ""}`);
if (!dry) await pingIndexNow(unique);
