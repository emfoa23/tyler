// 1회성 백필: node scripts/backfill.mjs [draws|wins|master|verify|all] [master시도목록]
// - draws : 1회차부터 전체 당첨결과 (10회차 윈도우 요청, ~124 요청)
// - wins  : 262회차(데이터 최초 존재)부터 회차별 1·2등 배출점 (~976 요청)
// - master: 전국 판매점 마스터. 두 번째 인자로 "서울,경기" 처럼 시도 부분집합 지정 가능
//           (IP 스로틀 회피용 — 그룹별로 러너를 바꿔 dispatch)
// - verify: 적재 건수·갭 검증
import {
  FIRST_WIN_SHOP_DRAW, expectedLatestDraw,
  fetchDrawWindow, fetchWins, mapDraw, mapWinRow, mapWinStore,
} from "./lib/dhlottery.mjs";
import { syncMaster } from "./lib/master.mjs";
import { chunks, sleep, uniqueBy } from "./lib/util.mjs";
import { countRows, insert, select, selectAll, upsert } from "./lib/supa.mjs";

const mode = process.argv[2] || "all";
const latest = expectedLatestDraw();
console.log(`expected latest draw: ${latest}`);

async function backfillDraws() {
  const rows = new Map();
  for (let center = 5; center <= latest + 4; center += 10) {
    const list = await fetchDrawWindow(Math.min(center, latest));
    for (const it of list) rows.set(it.ltEpsd, mapDraw(it));
    if (center % 200 === 5) console.log(`draws: fetched through center ${center} (${rows.size})`);
    await sleep(120);
  }
  const mapped = [...rows.values()];
  for (const chunk of chunks(mapped, 500)) await upsert("draws", chunk, "draw_no");
  console.log(`draws: ${mapped.length} upserted`);

  // 갭 보정
  const have = new Set((await selectAll("draws", "draw_no")).map((r) => r.draw_no));
  const missing = [];
  for (let n = 1; n <= latest; n++) if (!have.has(n)) missing.push(n);
  for (const n of missing) {
    const list = await fetchDrawWindow(n);
    const it = list.find((x) => x.ltEpsd === n);
    if (it) await upsert("draws", [mapDraw(it)], "draw_no");
    else console.warn(`draws: ${n} not available from API`);
    await sleep(120);
  }
  if (missing.length) console.log(`draws: filled ${missing.length} gaps`);
}

async function backfillWins() {
  const drawDates = new Map(
    (await selectAll("draws", "draw_no,draw_date")).map((r) => [r.draw_no, r.draw_date]),
  );
  const knownStores = new Set((await selectAll("stores", "store_id")).map((r) => r.store_id));
  let games = 0;
  for (let epsd = FIRST_WIN_SHOP_DRAW; epsd <= latest; epsd++) {
    const drawDate = drawDates.get(epsd);
    if (!drawDate) { console.warn(`wins ${epsd}: draw missing, skip`); continue; }
    const existing = await countRows(`store_wins?draw_no=eq.${epsd}`);
    // 행이 이미 있으면 API 호출 없이 스킵 — 스킵 구간에서 dhlottery 요청 예산을
    // 태우면 프런티어 도달 전에 스로틀에 걸린다(2026-08-16 실측: 6런이 13회차 전진).
    // 최신 회차의 드리프트 재보정은 sync-draw(최근 3회차)가 담당한다.
    if (existing > 0) continue;
    const wins = await fetchWins(epsd);
    const total = wins.total ?? 0;
    if (!total) { console.warn(`wins ${epsd}: API total=0, skip`); continue; }
    const d = { draw_no: epsd, draw_date: drawDate };
    const newStores = uniqueBy(
      wins.list.map(mapWinStore).filter((s) => !knownStores.has(s.store_id)),
      "store_id",
    );
    if (newStores.length) {
      await upsert("stores", newStores, "store_id", { ignore: true });
      for (const s of newStores) knownStores.add(s.store_id);
    }
    await insert("store_wins", wins.list.map((w) => mapWinRow(w, d)));
    games += total;
    if (epsd % 50 === 0) console.log(`wins: through draw ${epsd} (${games} rows this run)`);
    // 짧은 간격 대량 호출은 IP 단위 일시 차단을 유발한다 (2026-08-16 실측) — 여유 있게,
    // 30회차마다 쿨다운으로 WAF 속도 윈도우를 넘기지 않는다.
    await sleep(350);
    if (epsd % 30 === 0) await sleep(5000);
  }
  console.log(`wins: done (${games} rows inserted this run)`);
}

async function verify() {
  const drawCount = await countRows("draws");
  const minRow = await select("draws?select=draw_no&order=draw_no.asc&limit=1");
  const maxRow = await select("draws?select=draw_no&order=draw_no.desc&limit=1");
  const winCount = await countRows("store_wins");
  const storeCount = await countRows("stores");
  const masterCount = await countRows("stores?master_seen_at=not.is.null");
  console.log(JSON.stringify({
    drawCount,
    min: minRow[0]?.draw_no,
    max: maxRow[0]?.draw_no,
    winCount,
    storeCount,
    masterCount,
  }));
  const gaps = drawCount === latest ? "none" : `expected ${latest}, have ${drawCount}`;
  console.log(`draw coverage: ${gaps}`);
}

const sidoArg = (process.argv[3] || "").trim();
const sidoList = sidoArg ? sidoArg.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

if (mode === "draws" || mode === "all") await backfillDraws();
if (mode === "wins" || mode === "all") await backfillWins();
if (mode === "master" || mode === "all") await syncMaster(sidoList);
if (mode === "verify" || mode === "all") await verify();
