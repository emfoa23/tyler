// 주간 동기화: 신규 회차 당첨결과 → 배출점 → 생성번호 대조 → ISR revalidate.
// 멱등: 새 데이터가 없으면 아무것도 바꾸지 않고 성공 종료한다
// (토 20:50/21:05/21:30/23:05/23:30 + 일 10:00 KST 재시도 전제).
import {
  fetchDrawWindow, fetchWins, mapDraw, mapWinRow, mapWinStore,
} from "./lib/dhlottery.mjs";
import { countRows, del, insert, patchCount, rpc, select, upsert } from "./lib/supa.mjs";
import { sleep, uniqueBy } from "./lib/util.mjs";

const latestRows = await select("draws?select=draw_no,draw_date&order=draw_no.desc&limit=1");
if (!latestRows.length) {
  console.error("draws is empty — run `node scripts/backfill.mjs all` first");
  process.exit(1);
}

let cursor = latestRows[0].draw_no;
let changed = false;

// 0) 불변식: 1등 구매유형 합계 0 은 미공개·미상이라 null 이어야 한다 (mapDraw 규칙).
//    옛 적재분(261회차 이전·이른 슬롯이 0 으로 저장한 최신 회차)을 보정하고, 이후엔 0건이라 no-op.
const normalized = await patchCount(
  "draws?first_auto=eq.0&first_manual=eq.0&first_semi=eq.0",
  { first_auto: null, first_manual: null, first_semi: null },
);
if (normalized) {
  console.log(`draws: ${normalized} rows with zero purchase types normalized to null`);
  changed = true;
}

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

// 1.5) 최신 회차 지연 필드 재보정 — 1등 구매유형(winType)은 추첨 후 ~21:02 에야 공개되고
// (2026-08-15 회차 미러 실측: 번호 20:43 → 당첨금·인원·판매액 20:50 → 구매유형 21:02),
// 공개 전엔 null 이 아니라 0/0/0 으로 온다 (2026-08-22 실측 — mapDraw 가 null 로 정규화).
// 신규 루프는 넣은 회차를 다시 안 긁으므로, 최신 회차의 구매유형(1등 당첨자가 있는데 null)·
// 판매액이 비어 있으면 재조회하고 실제로 채워질 때만 upsert 한다.
const head = (await select(
  "draws?select=draw_no,r1_winners,first_auto,sales_total&order=draw_no.desc&limit=1",
))[0];
const needsTypes = !!head && head.first_auto === null && (head.r1_winners ?? 0) > 0;
const needsSales = !!head && head.sales_total === null;
if (needsTypes || needsSales) {
  const win = await fetchDrawWindow(head.draw_no);
  const item = win.find((x) => x.ltEpsd === head.draw_no);
  const row = item ? mapDraw(item) : null;
  const fills = !!row && (
    (needsTypes && row.first_auto !== null) || (needsSales && row.sales_total !== null)
  );
  if (fills) {
    await upsert("draws", [row], "draw_no");
    console.log(`draw ${head.draw_no}: late fields refreshed`);
    changed = true;
  } else {
    console.log(`draw ${head.draw_no}: late fields not published yet`);
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
