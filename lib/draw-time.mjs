// 추첨 시각 단일 소스 — 매주 토요일 20:35 KST. 앱(lib/lotto.ts)과 scripts/*.mjs 가 같은 파일을 import 한다.
export const WEEK_MS = 7 * 86400_000;
export const DRAW_TIME_KST = "20:35:00+09:00";

/** 회차 추첨 시각(epoch ms). @param {string} dateIso YYYY-MM-DD */
export function drawMoment(dateIso) {
  return new Date(`${dateIso}T${DRAW_TIME_KST}`).getTime();
}
