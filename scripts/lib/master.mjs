// 전국 판매점 마스터 동기화. 전량 drop 이 아니라 upsert + 미출현 지점 closed 마킹으로
// 폐업 지점의 배출 이력을 보존한다. (배출점으로만 알려진 지점은 master_seen_at 이 null 이라 건드리지 않는다.)
import { SIDO, fetchMasterPage, mapMasterStore } from "./dhlottery.mjs";
import { chunks, sleep, uniqueBy } from "./util.mjs";
import { patchCount, upsert } from "./supa.mjs";

export async function syncMaster() {
  const startIso = new Date().toISOString();
  const all = [];

  for (const sido of SIDO) {
    const first = await fetchMasterPage(sido, 1);
    const total = first.total ?? 0;
    const rows = [...(first.list ?? [])];
    const pages = Math.ceil(total / 10);
    for (let p = 2; p <= pages; p++) {
      const page = await fetchMasterPage(sido, p);
      rows.push(...(page.list ?? []));
      // 짧은 간격 대량 호출은 IP 단위 일시 차단을 유발한다 (2026-08-16 실측) — 여유 있게,
      // 100페이지마다 쿨다운으로 WAF 속도 윈도우를 넘기지 않는다.
      await sleep(250);
      if (p % 100 === 0) await sleep(5000);
    }
    // 페이징 중 목록이 흔들려 일부가 비면 전체를 실패로 처리한다
    // (부분 수집 상태로 closed 마킹이 돌면 멀쩡한 지점이 폐점 처리되므로).
    if (rows.length < total * 0.98) {
      throw new Error(`master ${sido}: collected ${rows.length}/${total}`);
    }
    console.log(`master ${sido}: ${rows.length}/${total}`);
    all.push(...rows);
  }

  const seenAt = new Date().toISOString();
  const mapped = uniqueBy(all.map((m) => mapMasterStore(m, seenAt)), "store_id");
  for (const chunk of chunks(mapped, 500)) {
    await upsert("stores", chunk, "store_id");
  }

  // 전 시도 수집이 성공했을 때만: 이전 마스터에는 있었는데 이번에 사라진 지점을 폐점 처리.
  const closed = await patchCount(
    `stores?master_seen_at=not.is.null&master_seen_at=lt.${encodeURIComponent(startIso)}&status=eq.open`,
    { status: "closed", updated_at: seenAt },
  );
  console.log(`master sync done: ${mapped.length} stores upserted, ${closed ?? 0} marked closed`);
  return { stores: mapped.length, closed: closed ?? 0 };
}
