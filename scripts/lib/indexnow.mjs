// IndexNow — 새 회차 반영 직후 검색엔진(네이버·Bing 등 참여 엔진 전체)에 변경 URL 을 즉시 알린다.
// 키는 비밀이 아니라 소유 증명용 공개 토큰(public/<key>.txt 로 노출돼야 한다).
export const INDEXNOW_KEY = "8dc005b9b2036b7cf457cc106477e9a6";
const HOST = "lottogen.click";

export async function pingIndexNow(paths) {
  const urlList = paths.map((p) => `https://${HOST}${p}`);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });
  return res.status; // 200/202 = 접수
}
