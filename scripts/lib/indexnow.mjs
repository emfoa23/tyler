// IndexNow — 바뀐 URL 을 참여 검색엔진(네이버·Bing·Yandex 등)에 즉시 알린다. 구글은 참여하지 않는다.
// 키는 비밀이 아니라 소유 증명용 공개 토큰(public/<key>.txt 로 노출돼야 한다).
// 한 요청에 최대 10,000 URL — 그 이상은 나눠 보낸다(일괄 알림용).
import { log, warn } from "./log.mjs";

export const INDEXNOW_KEY = "8dc005b9b2036b7cf457cc106477e9a6";
const HOST = "lottogen.click";
const BATCH = 10_000;

/** paths(경로) 또는 절대 URL 목록을 보낸다. 마지막 응답 상태를 돌려준다(200/202 = 접수). */
export async function pingIndexNow(paths) {
  const urlList = [...new Set(paths)].map((p) => (p.startsWith("http") ? p : `https://${HOST}${p}`));
  let status = null;
  for (let i = 0; i < urlList.length; i += BATCH) {
    const chunk = urlList.slice(i, i + BATCH);
    try {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: HOST,
          key: INDEXNOW_KEY,
          keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
          urlList: chunk,
        }),
      });
      status = res.status;
      log(`indexnow: ${res.status} (${chunk.length} urls${urlList.length > BATCH ? `, batch ${i / BATCH + 1}` : ""})`);
    } catch (e) {
      warn(`indexnow failed (non-fatal): ${e}`);
    }
  }
  return status;
}
