// 기기 식별자 — 생성 이력 보관과 방문·이용 통계(집계 전용)에 공용으로 쓰는 localStorage UUID.
// 키는 generate-client 시절 값('tyler_client_id')을 그대로 유지해 기존 기기의 연속성을 보존한다.
// 클라이언트 전용(브라우저 localStorage) — 서버 컴포넌트에서 import 금지.

// UUID v4. crypto.randomUUID 는 보안 컨텍스트(https·localhost)에만 있어 http://192.168.x.x 같은 LAN 테스트에선
// undefined 다(2026-09-07 폰 실측: "crypto.randomUUID is not a function"). getRandomValues 는 어디서나 있으므로
// 같은 규격(v4, RFC 4122 variant)으로 직접 만든다 — 서버 UUID_RE(/api/generate) 검증을 그대로 통과한다.
export function uuidV4(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getClientId(): string {
  const KEY = "tyler_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuidV4();
    localStorage.setItem(KEY, id);
  }
  return id;
}
