// 주간 동기화: 당첨결과(신규 회차 + 최신 회차 지연 필드) → 생성번호 대조 → 배출점 → ISR revalidate → IndexNow.
// 멱등: 새 데이터가 없으면 아무것도 바꾸지 않고 성공 종료한다.
// 슬롯(cron-job.org): 토 20:40~21:05 5분 간격 + 22:00/23:00 백스톱 + 일 10:00(배출점 재대조 포함).
//
// IO 원칙(2026-09-05): 슬롯당 동행복권 호출을 1~2회로 유지한다. 러너 IP 스로틀에 재시도가 누적되면
// 한 실행이 5~15분씩 늘어져 다음 슬롯까지 막는 것이 실측됐다. 호출·단계마다 경과 시간을 로그로 남긴다.
import {
  expectedLatestDraw, fetchDrawWindow, fetchWins, mapDraw, mapWinRow, mapWinStore,
} from "./lib/dhlottery.mjs";
import { countRows, del, insert, rpc, select, upsert } from "./lib/supa.mjs";
import { uniqueBy } from "./lib/util.mjs";
import { pingIndexNow } from "./lib/indexnow.mjs";
import { log, warn } from "./lib/log.mjs";
import { needsLateFields, publishedMore } from "../lib/draw-state.mjs";
import { drawMoment } from "../lib/draw-time.mjs";

// 검증 훅: SYNC_NOW=<ISO> 로 "지금"을 고정하면 기대 회차 계산과 12시간 규칙을 원하는 시점으로 시험할 수 있다.
const now = process.env.SYNC_NOW ? new Date(process.env.SYNC_NOW) : new Date();
// 추첨 후 이 시간이 지난 실행(일 10:00 슬롯)에서만 최근 3회차 배출점을 재대조한다.
const RECONCILE_AFTER_MS = 12 * 3600_000;

const HEAD_COLUMNS = "draw_no,draw_date,r1_winners,r5_winners,sales_total,first_auto,first_manual,first_semi";
const readHead = async () =>
  (await select(`draws?select=${HEAD_COLUMNS}&order=draw_no.desc&limit=1`))[0];

let head = await readHead();
if (!head) {
  console.error("draws is empty — run `node scripts/backfill.mjs all` first");
  process.exit(1);
}
let changed = false;
log(`start: now=${now.toISOString()} head=${head.draw_no} expected=${expectedLatestDraw(now)}`);

// 1) 당첨결과 — 호출 1회. 날짜로 계산한 기대 회차를 요청하면 응답 창(요청 회차부터 아래로 10개)에
//    신규 회차와 DB 최신 회차가 함께 들어 있어, 신규 적재와 지연 필드 재보정을 같은 응답으로 끝낸다.
//    기대 회차가 아직 미공개면 빈 배열이다 — 이때 DB 최신 회차가 기대-1 보다 낮으면(몇 주 밀린 복구
//    상황) 한 회차 아래를 한 번 더 조회한다.
const expected = expectedLatestDraw(now);
let win = await fetchDrawWindow(expected);
if (!win.length && head.draw_no < expected - 1) win = await fetchDrawWindow(expected - 1);
const fresh = win.filter((x) => x.ltEpsd > head.draw_no).sort((a, b) => a.ltEpsd - b.ltEpsd);
for (const item of fresh) {
  const row = mapDraw(item);
  await upsert("draws", [row], "draw_no");
  log(`draw ${row.draw_no}: results upserted${needsLateFields(row) ? " (late fields pending)" : ""}`);
  changed = true;
}
// 지연 필드 — 당첨금·판매액은 추첨 후 ~20:49, 1등 구매유형은 ~21:00 에야 공개되고 공개 전엔 0 으로 온다.
// 신규가 없을 때 DB 최신 회차에 미공개 묶음이 남았으면 같은 응답에서 재보정한다(판정: lib/draw-state).
if (!fresh.length && needsLateFields(head)) {
  const item = win.find((x) => x.ltEpsd === head.draw_no);
  const row = item ? mapDraw(item) : null;
  if (row && publishedMore(head, row)) {
    await upsert("draws", [row], "draw_no");
    log(`draw ${head.draw_no}: late fields refreshed${needsLateFields(row) ? " (some still pending)" : ""}`);
    changed = true;
  } else {
    log(`draw ${head.draw_no}: late fields not published yet`);
  }
}
if (fresh.length) head = await readHead();

// 2) 생성번호 대조 — 당첨번호만 있으면 되므로 1단계 직후. 미대조분(checked_at is null)만 갱신하는 멱등 RPC.
const recent = await select("draws?select=draw_no,draw_date&order=draw_no.desc&limit=3");
for (const d of recent) {
  const checked = await rpc("check_generated_sets", { p_draw: d.draw_no });
  if (checked) {
    log(`draw ${d.draw_no}: ${checked} generated sets checked`);
    changed = true;
  }
}

// 3) 배출점 — 결과보다 늦게(추첨 후 ~21:00) 공개된다.
//    평소엔 최신 회차에 행이 없을 때만 1회 조회한다. 추첨 후 12시간이 지난 실행에서만 최근 3회차를
//    재대조해 동행복권의 사후 정정을 흡수한다 — DB 건수 ≠ API total 이면 delete+재삽입(멱등).
const latest = recent[0];
const reconcile = now.getTime() - drawMoment(latest.draw_date) >= RECONCILE_AFTER_MS;
const latestCount = await countRows(`store_wins?draw_no=eq.${latest.draw_no}`);
const targets = reconcile ? [...recent].reverse() : latestCount === 0 ? [latest] : [];
log(
  `stores: ${reconcile ? "reconcile mode (≥12h after draw)" : latestCount === 0 ? "latest round has no rows" : "latest round already stored"}` +
  ` — ${targets.length} call(s)`,
);
for (const d of targets) {
  const wins = await fetchWins(d.draw_no);
  const total = wins.total ?? 0;
  if (!total) {
    log(`draw ${d.draw_no}: winning stores not published yet`);
    continue;
  }
  const dbCount = d.draw_no === latest.draw_no ? latestCount : await countRows(`store_wins?draw_no=eq.${d.draw_no}`);
  if (dbCount !== total) {
    const stores = uniqueBy(wins.list.map(mapWinStore), "store_id");
    await upsert("stores", stores, "store_id", { ignore: true });
    await del(`store_wins?draw_no=eq.${d.draw_no}`);
    await insert("store_wins", wins.list.map((w) => mapWinRow(w, d)));
    log(`draw ${d.draw_no}: ${total} winning-store rows stored (was ${dbCount})`);
    changed = true;
  } else {
    log(`draw ${d.draw_no}: winning stores unchanged (${total})`);
  }
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
    log(`revalidate: ${res.status}`);
  } catch (e) {
    warn(`revalidate failed (non-fatal): ${e}`);
  }
}

// 5) 변경이 있었으면 IndexNow 핑 — 새 회차 페이지가 검색엔진에 빨리 잡히게 (비치명, 실패해도 성공 종료)
if (changed) {
  const latestNo = head.draw_no;
  const paths = ["/", "/history", "/stores", "/numbers", "/numbers/missing", `/history/${latestNo}`];
  try {
    log(`indexnow: ${await pingIndexNow(paths)} (${paths.length} urls)`);
  } catch (e) {
    warn(`indexnow failed (non-fatal): ${e}`);
  }
}

log(changed ? "sync-draw: done (changes applied)" : "sync-draw: done (no changes)");
