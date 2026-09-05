// 전국 판매점 마스터 동기화. 전량 drop 이 아니라 upsert + 미출현 지점 closed 마킹으로
// 폐업 지점의 배출 이력을 보존한다. (배출점으로만 알려진 지점은 master_seen_at 이 null 이라 건드리지 않는다.)
//
// 질의 단위(MASTER_QUERIES)로 돈다 — 마스터 API 의 시도 어휘가 표준과 어긋나는 케이스
// (광주·전남='전남광주' 통합 권역)가 있어, "이 질의가 어느 시도의 전체를 커버하는가"(marks)를
// 질의 정의에 붙였다. closed 마킹은 완주한 질의의 marks 시도에만 수행한다 — 커버리지 보장이
// 없는 질의로 마킹하면 멀쩡한 지점이 대량 오폐점된다.
import { MASTER_QUERIES, fetchMasterPage, mapMasterStore } from "./dhlottery.mjs";
import { chunks, sleep, uniqueBy } from "./util.mjs";
import { patchCount, upsert } from "./supa.mjs";
import { log } from "./log.mjs";

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
      // ~40페이지 연속 버스트가 IP 차단을 트리거하는 것이 반복 실측됨 — 더 예의 있게.
      await sleep(1200);
      if (p % 25 === 0) await sleep(10_000);
    }
    // 페이징 중 목록이 흔들려 일부가 비면 해당 질의를 실패로 처리한다
    // (부분 수집 상태로 closed 마킹이 돌면 멀쩡한 지점이 폐점 처리되므로).
    if (rows.length < total * 0.98) {
      throw new Error(`master ${query}: collected ${rows.length}/${total}`);
    }
    // 질의 단위로 즉시 upsert — 런이 중간에 죽어도 완주한 질의는 온전히 남는다.
    const seenAt = new Date().toISOString();
    const mapped = uniqueBy(rows.map((m) => mapMasterStore(m, seenAt)), "store_id");
    for (const chunk of chunks(mapped, 500)) {
      await upsert("stores", chunk, "store_id");
    }
    // 완주한 질의가 전체 커버리지를 보장하는 시도(marks)만 폐점 마킹.
    let closed = 0;
    for (const sido of marks) {
      const n = await patchCount(
        `stores?sido=eq.${encodeURIComponent(sido)}&master_seen_at=not.is.null&master_seen_at=lt.${encodeURIComponent(startIso)}&status=eq.open`,
        { status: "closed", updated_at: new Date().toISOString() },
      );
      closed += n ?? 0;
    }
    grand += mapped.length;
    closedTotal += closed;
    log(`master ${query}: ${mapped.length}/${total} upserted, ${closed} closed [marks: ${marks.join(",") || "-"}]`);
  }

  log(`master sync done (${queries.length}/${MASTER_QUERIES.length} queries): ${grand} upserted, ${closedTotal} closed`);
  return { stores: grand, closed: closedTotal };
}
