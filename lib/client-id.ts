// 기기 식별자 — 생성 이력 보관과 방문·이용 통계(집계 전용)에 공용으로 쓰는 localStorage UUID.
// 키는 generate-client 시절 값('tyler_client_id')을 그대로 유지해 기존 기기의 연속성을 보존한다.
// 클라이언트 전용(브라우저 localStorage) — 서버 컴포넌트에서 import 금지.
export function getClientId(): string {
  const KEY = "tyler_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
