// 스크립트 공용 로그 — 프로세스 시작 기준 경과 초를 앞에 붙인다.
// 슬롯 로그만으로 어느 단계·어느 원본 호출이 얼마나 걸렸는지 복원할 수 있게 하는 것이 목적
// (2026-09-05: 단계 타임스탬프가 없어 5~15분짜리 실행의 원인을 못 가렸다).
const t0 = Date.now();

export const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1);

export function log(msg) {
  console.log(`[+${elapsed()}s] ${msg}`);
}

export function warn(msg) {
  console.warn(`[+${elapsed()}s] ${msg}`);
}
