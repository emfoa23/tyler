// '하루' 단일 소스 — 하루 = Asia/Seoul 달력일 [00:00, 24:00). 앱(app/*·lib/*.ts·components/*)과 scripts/*.mjs 가
// 같은 파일을 import 한다(lib/draw-time.mjs 와 같은 방식). 순간은 Date/timestamptz, 날짜는 KST 달력일 문자열
// (YYYY-MM-DD)로만 다루고, "최근 24시간" 같은 롤링 창은 '하루'라 부르지 않는다(2026-09-10 확정 — 생성 한도가
// 롤링 24시간이라 문구·방침의 '일일'과 어긋났던 것이 계기).
// 이 파일 밖에서는 timeZone·toLocaleDateString·getDay()류·+9시간 산술을 쓰지 않는다 — scripts/check-kst.mjs 가
// 빌드 전에 검사한다(package.json prebuild). SQL 쪽 짝은 supabase/schema.sql 의 kst_today()·kst_day()·kst_day_start().
// KST 는 1988년 이후 DST 가 없어 하루가 정확히 86,400초다 — kstDayAdd 는 그 전제 위에 있다.

export const KST_OFFSET = "+09:00";
const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateTimeFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** @param {Date | number | string} at 순간(Date·epoch ms·ISO 문자열) */
function toDate(at) {
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) throw new RangeError(`invalid time: ${String(at)}`);
  return d;
}

/** @param {string} day */
function assertDay(day) {
  if (!DAY_RE.test(day)) throw new RangeError(`invalid KST day: ${day}`);
}

/** 순간이 속한 KST 달력일(YYYY-MM-DD). @param {Date | number | string} [at] 기본 지금 */
export function kstDay(at = new Date()) {
  return dayFormat.format(toDate(at));
}

/** 그 KST 달력일이 시작하는 순간(00:00 KST). @param {string} day YYYY-MM-DD */
export function kstDayStart(day) {
  assertDay(day);
  return new Date(`${day}T00:00:00${KST_OFFSET}`);
}

/** n 일 뒤(음수면 앞)의 KST 달력일. @param {string} day YYYY-MM-DD @param {number} n */
export function kstDayAdd(day, n) {
  return kstDay(kstDayStart(day).getTime() + n * DAY_MS);
}

/** 표시용 "YYYY-MM-DD HH:mm:ss"(KST). @param {Date | number | string} at */
export function kstDateTime(at) {
  return dateTimeFormat.format(toDate(at));
}
