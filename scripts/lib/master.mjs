// 전국 판매점 마스터 동기화. 전량 drop 이 아니라 upsert + 미출현 지점 closed 마킹으로
// 폐업 지점의 배출 이력을 보존한다. (배출점으로만 알려진 지점은 master_seen_at 이 null 이라 건드리지 않는다.)
//
// 질의 단위(MASTER_QUERIES)로 돈다 — 마스터 API 의 시도 어휘가 표준과 어긋나는 케이스
// (광주·전남='전남광주' 통합 권역)가 있어, "이 질의가 어느 시도의 전체를 커버하는가"(marks)를
// 질의 정의에 붙였다. closed 마킹은 완주한 질의의 marks 시도에만 수행한다 — 커버리지 보장이
// 없는 질의로 마킹하면 멀쩡한 지점이 대량 오폐점된다.
//
// 변경 감지(2026-09-06): 갱신 전후를 비교해 상호·주소·시도·시군구·상태가 바뀐 지점과 새 지점, 이번에 폐점
// 처리되는 지점만 골라 그 지점 페이지·그 지점이 나오는 회차 페이지·홈·순위 캐시를 지우고 같은 목록을
// IndexNow 로 알린다. 캐시가 7일이라 여기서 안 지우면 폐점이 최대 7일 늦게 보인다(lib/cache-policy).
import { MASTER_QUERIES, fetchMasterPage, mapMasterStore } from "./dhlottery.mjs";
import { chunks, sleep, uniqueBy } from "./util.mjs";
import { patchCount, select, upsert } from "./supa.mjs";
import { log } from "./log.mjs";
import { revalidate } from "./ops.mjs";
import { pingIndexNow } from "./indexnow.mjs";
import { addCore, addRound, addStores, isEmpty, newChangeSet, summary } from "./changes.mjs";

const COMPARE_FIELDS = ["name", "address", "sido", "sigungu", "status"];
const IN_CHUNK = 200; // PostgREST in.(...) 한 번에 넣는 id 수 (URL 길이 여유)

/** 갱신 전(existing) 대비 mapped 에서 페이지 내용이 바뀌는 지점 id — 새 지점 포함. 순수 함수(시험용 export). */
export function diffStores(existing, mapped) {
  const byId = new Map(existing.map((r) => [r.store_id, r]));
  const changed = [];
  for (const m of mapped) {
    const e = byId.get(m.store_id);
    if (!e || COMPARE_FIELDS.some((f) => (e[f] ?? null) !== (m[f] ?? null))) changed.push(m.store_id);
  }
  return changed;
}

async function selectIn(table, columns, ids, extra = "") {
  const out = [];
  for (const part of chunks(ids, IN_CHUNK)) {
    out.push(...(await select(`${table}?select=${columns}&store_id=in.(${part.map(encodeURIComponent).join(",")})${extra}`)));
  }
  return out;
}

export async function syncMaster(queryNames) {
  const queries = queryNames?.length
    ? queryNames.map((n) => {
        const q = MASTER_QUERIES.find((x) => x.query === n);
        if (!q) throw new Error(`unknown master query: ${n}`);
        return q;
      })
    : MASTER_QUERIES;

  let grand = 0;
  let closedTotal = 0;

  for (const { query, marks } of queries) {
    const startIso = new Date().toISOString();
    const first = await fetchMasterPage(query, 1);
    const total = first.total ?? 0;
    const rows = [...(first.list ?? [])];
    const pages = Math.ceil(total / 10);
    log(`master ${query}: ${total} stores, ${pages} pages`);
    for (let p = 2; p <= pages; p++) {
      const page = await fetchMasterPage(query, p);
      rows.push(...(page.list ?? []));
      // 페이지 간 1.2s 는 유지. 25페이지마다 두던 10s 쿨다운은 제거 — 스로틀은 새 TCP 연결에 걸리므로
      // (dhlottery.mjs) 쿨다운이 keep-alive 소켓을 유휴로 닫히게 해 오히려 51·101페이지에서 새 연결이
      // 막혔다(2026-09-06 서울 런: 1~50·52~100 은 실패 0, 51·101 만 15s 타임아웃 7~8회). 한 연결로 쉼 없이 간다.
      await sleep(1200);
    }
    // 페이징 중 목록이 흔들려 일부가 비면 해당 질의를 실패로 처리한다
    // (부분 수집 상태로 closed 마킹이 돌면 멀쩡한 지점이 폐점 처리되므로).
    if (rows.length < total * 0.98) {
      throw new Error(`master ${query}: collected ${rows.length}/${total}`);
    }
    const seenAt = new Date().toISOString();
    const mapped = uniqueBy(rows.map((m) => mapMasterStore(m, seenAt)), "store_id");

    // 변경 감지 1: 갱신 전 행과 비교(새 지점·상호/주소/상태 변경)
    const existing = await selectIn("stores", "store_id,name,address,sido,sigungu,status", mapped.map((m) => m.store_id));
    const changedIds = new Set(diffStores(existing, mapped));

    // 질의 단위로 즉시 upsert — 런이 중간에 죽어도 완주한 질의는 온전히 남는다.
    for (const chunk of chunks(mapped, 500)) {
      await upsert("stores", chunk, "store_id");
    }
    // 완주한 질의가 전체 커버리지를 보장하는 시도(marks)만 폐점 마킹. 변경 감지 2: 이번에 닫히는 지점.
    let closed = 0;
    for (const sido of marks) {
      const cond = `stores?sido=eq.${encodeURIComponent(sido)}&master_seen_at=not.is.null&master_seen_at=lt.${encodeURIComponent(startIso)}&status=eq.open`;
      for (const r of await select(`${cond}&select=store_id`)) changedIds.add(r.store_id);
      const n = await patchCount(cond, { status: "closed", updated_at: new Date().toISOString() });
      closed += n ?? 0;
    }
    grand += mapped.length;
    closedTotal += closed;

    // 바뀐 지점의 페이지 + 그 지점이 나오는 회차 페이지 + 홈·순위 캐시를 지우고 IndexNow 로 알린다.
    const cs = newChangeSet();
    if (changedIds.size) {
      const ids = [...changedIds];
      addCore(cs, ["ranking"]);
      addStores(cs, ids);
      const rounds = new Set((await selectIn("store_wins", "draw_no", ids)).map((r) => r.draw_no));
      for (const n of rounds) addRound(cs, n);
    }
    log(`master ${query}: ${mapped.length}/${total} upserted, ${closed} closed, ${changedIds.size} changed [marks: ${marks.join(",") || "-"}] → ${isEmpty(cs) ? "no page changes" : summary(cs)}`);
    if (!isEmpty(cs)) {
      await revalidate(cs);
      await pingIndexNow([...cs.urls]);
    }
  }

  log(`master sync done (${queries.length}/${MASTER_QUERIES.length} queries): ${grand} upserted, ${closedTotal} closed`);
  return { stores: grand, closed: closedTotal };
}
