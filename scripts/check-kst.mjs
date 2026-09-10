#!/usr/bin/env node
// '하루 = KST 달력일' 규약 검사 — 빌드 전에 돈다(package.json prebuild; Vercel 도 `npm run build` 를 실행하므로
// 위반은 배포 실패로 드러난다). 규약 정본은 README '시간 기준' 절.
// ① 앱·스크립트: 날짜 계산은 lib/kst.mjs(순간→달력일)와 lib/draw-time.mjs(추첨 시각)만 한다. 그 밖의 파일에서
//    timeZone·toLocaleDateString·getDay()류·+9시간 산술·ISO 문자열 자르기·"지금-24시간" 창을 쓰면 실패.
// ② supabase/schema.sql: 함수 본문의 날짜 계산은 kst_today()/kst_day()/kst_day_start() 만 한다. current_date·
//    now()::date·date_trunc('day')·인라인 at time zone·*_at::date 는 kst_* 정의 밖에서 금지(세션 TimeZone 이 UTC 라
//    bare 캐스트는 조용히 UTC 날짜가 된다).
// ③ 스케줄은 cron-job.org(Asia/Seoul)만 — GitHub 워크플로 `schedule:`·vercel.json `crons` 는 UTC 기준이라 금지.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = ["app", "lib", "components", "scripts", "tests"];
const EXT = new Set([".ts", ".tsx", ".mjs", ".js"]);
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const ALLOW = new Set(["lib/kst.mjs", "lib/draw-time.mjs", "scripts/check-kst.mjs"]);

/** @type {[RegExp, string][]} */
const JS_RULES = [
  [/\btoLocaleDateString\s*\(/, "toLocaleDateString → kstDay()"],
  [/\btoLocaleTimeString\s*\(/, "toLocaleTimeString → kstDateTime()"],
  [/\btimeZone\s*:/, "timeZone 옵션은 lib/kst.mjs 안에서만"],
  [/\bIntl\.DateTimeFormat\s*\(/, "Intl.DateTimeFormat 은 lib/kst.mjs 안에서만"],
  [/\.get(?:UTC)?(?:Day|Date|Hours|Month|FullYear)\s*\(\s*\)/, "Date getter(로컬·UTC) → kstDay()/kstDateTime()"],
  [/\.set(?:UTC)?(?:Date|Hours|Month|FullYear)\s*\(/, "Date setter → kstDayAdd()/kstDayStart()"],
  [/toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/, "ISO 문자열 자르기는 UTC 날짜 → kstDay()"],
  [/\b9\s*\*\s*3600|\b32400(?:_?000)?\b/, "+9시간 산술 → kstDay()/kstDateTime()"],
  [/Date\.now\(\)\s*[-+]\s*(?:86400|24\s*\*\s*3600)/, "\"지금-24시간\" 창은 하루가 아니다 → kstDayStart(kstDay())"],
  [/\bgetTimezoneOffset\b/, "getTimezoneOffset → 시간대는 항상 Asia/Seoul"],
];

/** @type {[RegExp, string][]} */
const SQL_RULES = [
  [/\bcurrent_date\b/i, "current_date(세션 UTC) → kst_today()"],
  [/now\(\)\s*::\s*date/i, "now()::date(세션 UTC) → kst_today()"],
  [/date_trunc\(\s*'day'/i, "date_trunc('day') → kst_day()"],
  [/\blocaltimestamp\b|\bcurrent_timestamp\b/i, "세션 시간대 의존 → now() 와 kst_*"],
  [/\bat\s+time\s+zone\b/i, "인라인 at time zone → kst_day()/kst_day_start()"],
  [/\w+_at\s*::\s*date\b/i, "timestamptz::date 는 UTC 날짜 → kst_day()"],
  [/\btimezone\s*\(/i, "timezone() → kst_*"],
];

/** @type {string[]} */
const violations = [];
let fileCount = 0;

/** @param {string} dir */
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!EXT.has(extname(name))) continue;
    const rel = relative(ROOT, full);
    if (ALLOW.has(rel)) continue;
    fileCount++;
    readFileSync(full, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const [re, why] of JS_RULES) {
          if (re.test(line)) violations.push(`${rel}:${i + 1}: ${why}\n    ${line.trim().slice(0, 120)}`);
        }
      });
  }
}

for (const d of SCAN_DIRS) {
  try {
    if (statSync(join(ROOT, d)).isDirectory()) walk(join(ROOT, d));
  } catch {
    // 없는 디렉토리는 건너뜀
  }
}

// ② schema.sql — kst_* 함수 정의 스팬(본문에 at time zone 이 있어야 하는 유일한 곳)만 제외하고 전부 검사한다.
const SQL_PATH = "supabase/schema.sql";
const sql = readFileSync(join(ROOT, SQL_PATH), "utf8");
/** @type {[number, number][]} */
const allowSpans = [];
const defRe = /create\s+(?:or\s+replace\s+)?function\s+(kst_\w+)\s*\(/gi;
for (let m; (m = defRe.exec(sql)); ) {
  const end = sql.indexOf("$$;", m.index);
  allowSpans.push([m.index, end < 0 ? sql.length : end + 3]);
}
let offset = 0;
let sqlLines = 0;
sql.split("\n").forEach((raw, i) => {
  const start = offset;
  offset += raw.length + 1;
  if (allowSpans.some(([a, b]) => start >= a && start < b)) return;
  const line = raw.replace(/--.*$/, ""); // 주석은 검사 대상이 아니다
  if (!line.trim()) return;
  sqlLines++;
  for (const [re, why] of SQL_RULES) {
    if (re.test(line)) violations.push(`${SQL_PATH}:${i + 1}: ${why}\n    ${raw.trim().slice(0, 120)}`);
  }
});

// ③ UTC 스케줄러 금지
try {
  const wfDir = join(ROOT, ".github/workflows");
  for (const name of readdirSync(wfDir)) {
    readFileSync(join(wfDir, name), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*schedule\s*:/.test(line)) {
          violations.push(`.github/workflows/${name}:${i + 1}: GitHub schedule 은 UTC — cron-job.org(Asia/Seoul) 로 dispatch`);
        }
      });
  }
} catch {
  // 워크플로 디렉토리 없음
}
try {
  const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
  if (vercel.crons) violations.push("vercel.json: crons 는 UTC — cron-job.org(Asia/Seoul) 를 쓴다");
} catch {
  // vercel.json 없음
}

if (violations.length) {
  console.error(`kst check FAILED — ${violations.length}건. 하루 = KST 달력일, 날짜 계산은 lib/kst.mjs·kst_*() 만(README '시간 기준').`);
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log(`kst check ok — js/ts ${fileCount} files, schema.sql ${sqlLines} lines`);
