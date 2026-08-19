// 주간 동기화: 신규 회차 당첨결과 → 배출점 → 생성번호 대조 → ISR revalidate.
// 멱등: 새 데이터가 없으면 아무것도 바꾸지 않고 성공 종료한다 (토 21:00/21:30/23:00 + 일 10:00 재시도 전제).
import {
  fetchDrawWindow, fetchWins, mapDraw, mapWinRow, mapWinStore,
} from "./lib/dhlottery.mjs";
import { countRows, del, insert, rpc, select, upsert } from "./lib/supa.mjs";
import { sleep, uniqueBy } from "./lib/util.mjs";

const latestRows = await select("draws?select=draw_no,draw_date&order=draw_no.desc&limit=1");
if (!latestRows.length) {
  console.error("draws is empty — run `node scripts/backfill.mjs all` first");
  process.exit(1);
}

let cursor = latestRows[0].draw_no;
let changed = false;

// 1) 신규 회차 당첨결과 (여러 주 밀렸어도 따라잡는다)
for (;;) {
  const next = cursor + 1;
  const win = await fetchDrawWindow(next);
  const item = win.find((x) => x.ltEpsd === next);
  if (!item) break;
  await upsert("draws", [mapDraw(item)], "draw_no");
  console.log(`draw ${next}: results upserted`);
  changed = true;
  cursor = next;
  await sleep(150);
}

// 1.5) 최신 회차 결과 재보정 — 1등 구매유형(winType)은 추첨 후 ~21:02 에야 공개된다
// (2026-08-15 회차 미러 실측: 번호 20:43 → 당첨금·인원·판매액 20:50 → 구매유형 21:02).
// 이른 슬롯이 null 로 저장한 채 신규 루프가 다시 안 긁으므로 여기서 채운다.
const head = (await select(
  "draws?select=draw_no,first_auto,sales_total&order=draw_no.desc&limit=1",
))[0];
if (head && (head.first_auto === null || head.sales_total === null)) {
  const win = await fetchDrawWindow(head.draw_no);
  const item = win.find((x) => x.ltEpsd === head.draw_no);
  if (item && (item.winType1 != null || item.wholEpsdSumNtslAmt != null)) {
    await upsert("draws", [mapDraw(item)], "draw_no");
    console.log(`draw ${head.draw_no}: late fields refreshed`);
    changed = true;
  }
  await sleep(150);
}

// 2) 최근 회차의 배출점 보정 (결과보다 늦게 공개되는 경우를 재시도 슬롯에서 흡수)
const recent = await select("draws?select=draw_no,draw_date&order=draw_no.desc&limit=3");
for (const d of recent.reverse()) {
  const wins = await fetchWins(d.draw_no);
  const total = wins.total ?? 0;
  if (!total) {
    console.log(`draw ${d.draw_no}: winning stores not published yet`);
    continue;
  }
  const dbCount = await countRows(`store_wins?draw_no=eq.${d.draw_no}`);
  if (dbCount !== total) {
    const stores = uniqueBy(wins.list.map(mapWinStore), "store_id");
    await upsert("stores", stores, "store_id", { ignore: true });
    await del(`store_wins?draw_no=eq.${d.draw_no}`);
    await insert("store_wins", wins.list.map((w) => mapWinRow(w, d)));
    console.log(`draw ${d.draw_no}: ${total} winning-store rows stored (was ${dbCount})`);
    changed = true;
  }
  // 3) 생성번호 대조 (미대조분만 갱신하므로 매 실행 안전)
  const checked = await rpc("check_generated_sets", { p_draw: d.draw_no });
  if (checked) {
    console.log(`draw ${d.draw_no}: ${checked} generated sets checked`);
    changed = true;
  }
  await sleep(150);
}

// 4) 변경이 있었으면 사이트 ISR revalidate
const site = process.env.SITE_URL;
const secret = process.env.OPS_SECRET;
if (changed && site && secret) {
  try {
    const res = await fetch(`${site}/api/ops/revalidate`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    console.log(`revalidate: ${res.status}`);
  } catch (e) {
    console.warn(`revalidate failed (non-fatal): ${e}`);
  }
}

console.log(changed ? "sync-draw: done (changes applied)" : "sync-draw: done (no changes)");
