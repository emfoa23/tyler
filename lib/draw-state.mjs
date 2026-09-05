// 회차 결과의 "공개 여부" 판정 — 단일 소스. 앱(TS, allowJs)과 scripts/*.mjs 가 같은 파일을 import 한다.
//
// 동행복권 API 는 추첨 직후 아직 공개되지 않은 값을 null 이 아니라 0 으로 준다(2026-09-05 실측:
// 번호 20:42 → 당첨금·판매액 ~20:49 → 1등 구매유형·배출점 ~21:00). DB 에는 원본 값을 그대로 두고
// (0 을 null 로 바꾸지 않는다) 화면과 동기화 스크립트는 이 모듈의 판정만 공유한다.
//
// 판정은 필드 하나가 아니라 원천이 한 번에 공개하는 묶음 단위다:
//   - 당첨금 묶음(등위별 당첨자수·1인당/총 당첨금): 5등 당첨자 > 0.
//     5등·판매액이 0 인 회차는 1,239회 중 하나도 없고, 1등 0 은 이월 회차 14개의 실제 값이라 기준이 못 된다.
//   - 판매액: > 0.
//   - 1등 구매유형: 1등 당첨자가 있는데 세 유형 합이 0 이면 미공개. 개별 유형 0(반자동 0 등)은 정상 값.
//   - 배출점은 store_wins 행 유무로 판단한다(이 모듈 대상 아님).

/**
 * @typedef {{
 *   r1_winners?: number | null,
 *   r5_winners?: number | null,
 *   sales_total?: number | null,
 *   first_auto?: number | null,
 *   first_manual?: number | null,
 *   first_semi?: number | null,
 * }} DrawLike
 */

/** 등위별 당첨자수·당첨금 묶음이 공개됐는가. @param {DrawLike} d */
export function isPrizePublished(d) {
  return (d.r5_winners ?? 0) > 0;
}

/** 회차 판매액이 공개됐는가. @param {DrawLike} d */
export function isSalesPublished(d) {
  return (d.sales_total ?? 0) > 0;
}

/** 1등 구매유형 합계(자동+수동+반자동). @param {DrawLike} d */
export function firstTypeTotal(d) {
  return (d.first_auto ?? 0) + (d.first_manual ?? 0) + (d.first_semi ?? 0);
}

/**
 * 1등 구매유형이 공개됐는가. 1등 0명(이월·미공개)은 유형이 있을 수 없으므로 "공개할 것 없음" = true.
 * 당첨금 묶음 미공개 상태(1등 0)는 isPrizePublished 가 따로 거른다.
 * @param {DrawLike} d
 */
export function isFirstTypePublished(d) {
  return (d.r1_winners ?? 0) === 0 ? true : firstTypeTotal(d) > 0;
}

/** 지연 필드(당첨금 묶음·판매액·구매유형) 중 미공개가 남았는가 — 동기화의 재조회 조건. @param {DrawLike} d */
export function needsLateFields(d) {
  return !isPrizePublished(d) || !isSalesPublished(d) || !isFirstTypePublished(d);
}

/** 재조회 결과(row)가 DB 행(head)보다 더 공개된 상태인가 — upsert 할지 판단. @param {DrawLike} head @param {DrawLike} row */
export function publishedMore(head, row) {
  return (
    (isPrizePublished(row) && !isPrizePublished(head)) ||
    (isSalesPublished(row) && !isSalesPublished(head)) ||
    (isFirstTypePublished(row) && !isFirstTypePublished(head))
  );
}
