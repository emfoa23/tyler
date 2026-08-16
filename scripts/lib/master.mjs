// 전국 판매점 마스터 동기화. 전량 drop 이 아니라 upsert + 미출현 지점 closed 마킹으로
// 폐업 지점의 배출 이력을 보존한다. (배출점으로만 알려진 지점은 master_seen_at 이 null 이라 건드리지 않는다.)
//
// sidos 부분집합 실행을 지원한다 — dhlottery 는 지속 크롤 수백 요청이면 IP 스로틀을 걸므로
// (2026-08-16 실측), 백필은 시도 그룹으로 나눠 러너를 바꿔가며 돈다.
// 미출현 closed 마킹은 "전체 시도를 한 번에 돈 실행"에서만 수행한다 (부분 실행에서 돌리면
// 이번에 안 돈 시도 전체가 폐점 처리되는 참사가 난다).
import { SIDO, fetchMasterPage, mapMasterStore } from "./dhlottery.mjs";
import { chunks, sleep, uniqueBy } from "./util.mjs";
import { patchCount, upsert } from "./supa.mjs";

export async function syncMaster(sidos = SIDO) {
  let grand = 0;
  let closedTotal = 0;

  for (const sido of sidos) {
    if (!SIDO.includes(sido)) throw new Error(`unknown sido: ${sido}`);
    const sidoStartIso = new Date().toISOString();
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
    // 페이징 중 목록이 흔들려 일부가 비면 해당 시도를 실패로 처리한다
    // (부분 수집 상태로 closed 마킹이 돌면 멀쩡한 지점이 폐점 처리되므로).
    if (rows.length < total * 0.98) {
      throw new Error(`master ${sido}: collected ${rows.length}/${total}`);
    }
    // 시도 단위로 즉시 upsert — 런이 중간에 죽어도 완료한 시도는 온전히 남는다.
    const seenAt = new Date().toISOString();
    const mapped = uniqueBy(rows.map((m) => mapMasterStore(m, seenAt)), "store_id");
    for (const chunk of chunks(mapped, 500)) {
      await upsert("stores", chunk, "store_id");
    }
    // closed 마킹도 시도 단위로 자기완결 — 이 시도를 완주했으므로, 이 시도에서
    // 과거 마스터엔 있었는데 이번에 안 보인 지점만 폐점 처리한다.
    // (master_seen_at null = 배출점으로만 알려진 지점·온라인 채널 — 건드리지 않는다.)
    const closed = await patchCount(
      `stores?sido=eq.${encodeURIComponent(sido)}&master_seen_at=not.is.null&master_seen_at=lt.${encodeURIComponent(sidoStartIso)}&status=eq.open`,
      { status: "closed", updated_at: new Date().toISOString() },
    );
    grand += mapped.length;
    closedTotal += closed ?? 0;
    console.log(`master ${sido}: ${mapped.length}/${total} upserted, ${closed ?? 0} closed`);
  }

  console.log(`master sync done (${sidos.length}/${SIDO.length} sido): ${grand} upserted, ${closedTotal} closed`);
  return { stores: grand, closed: closedTotal };
}
