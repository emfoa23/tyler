// '하루 = KST 달력일' 경계 테스트 — `npm test`(node --test, 의존성 없음). prebuild 로 빌드마다 돈다.
import test from "node:test";
import assert from "node:assert/strict";
import { kstDay, kstDayStart, kstDayAdd, kstDateTime } from "../lib/kst.mjs";
import { drawDateFor, targetDrawFor } from "../lib/lotto.ts";

test("kstDay: UTC 날짜가 바뀌기 전후 — 15:00Z 가 00:00 KST", () => {
  assert.equal(kstDay(new Date("2026-09-10T14:59:59Z")), "2026-09-10");
  assert.equal(kstDay(new Date("2026-09-10T15:00:00Z")), "2026-09-11");
  assert.equal(kstDay("2026-12-31T15:00:00Z"), "2027-01-01");
  assert.equal(kstDay(Date.UTC(2026, 8, 10, 15)), "2026-09-11");
  assert.throws(() => kstDay("not a time"), RangeError);
});

test("kstDayStart: 그 날 00:00 KST 의 순간이고 kstDay 와 왕복한다", () => {
  assert.equal(kstDayStart("2026-09-11").toISOString(), "2026-09-10T15:00:00.000Z");
  assert.equal(kstDay(kstDayStart("2026-09-11")), "2026-09-11");
  assert.equal(kstDay(kstDayStart("2026-09-11").getTime() - 1), "2026-09-10");
  assert.throws(() => kstDayStart("2026-9-1"), RangeError);
});

test("kstDayAdd: 월·연·윤년 경계", () => {
  assert.equal(kstDayAdd("2026-09-01", -1), "2026-08-31");
  assert.equal(kstDayAdd("2026-12-31", 1), "2027-01-01");
  assert.equal(kstDayAdd("2028-02-28", 1), "2028-02-29");
  assert.equal(kstDayAdd("2026-09-10", -6), "2026-09-04"); // 어드민 7일 창의 시작일
});

test("kstDateTime: 표시용 KST, 자정은 24 가 아니라 00", () => {
  assert.equal(kstDateTime("2026-09-10T15:00:00Z"), "2026-09-11 00:00:00");
  assert.equal(kstDateTime(new Date("2026-09-10T02:03:04Z")), "2026-09-10 11:03:04");
});

test("생성 한도 창: 자정(KST) 직전 생성분은 자정 이후 창에서 빠진다", () => {
  const since = kstDayStart(kstDay(new Date("2026-09-10T15:00:00Z"))); // 9/11 00:00 KST
  assert.ok(new Date("2026-09-10T14:59:59Z") < since);
  assert.ok(new Date("2026-09-10T15:00:00Z") >= since);
});

test("회차: drawDateFor 는 KST 달력일, targetDrawFor 는 20:35 KST 경계", () => {
  const latest = { draw_no: 1240, draw_date: "2026-09-05" };
  assert.equal(drawDateFor(latest, 1241), "2026-09-12");
  assert.equal(drawDateFor(latest, 1239), "2026-08-29");
  assert.equal(targetDrawFor(new Date("2026-09-05T11:35:00Z"), latest), 1240); // 추첨 순간까지는 그 회차
  assert.equal(targetDrawFor(new Date("2026-09-05T11:35:01Z"), latest), 1241);
});
