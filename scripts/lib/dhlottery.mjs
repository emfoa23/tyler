// 동행복권 신규 API 클라이언트 (2026-08 개편 후 사이트 기준).
// 전부 GET + UTF-8 JSON. KR IP 기준 헤더 없이 호출 가능.
import https from "node:https";
import { sleep } from "./util.mjs";

const BASE = "https://www.dhlottery.co.kr";

// selectLtShp.do 의 srchCtpvNm 은 짧은 시도명만 인식한다("서울특별시"는 total=0).
export const SIDO = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 배출점 데이터가 존재하는 최초 회차 (이전 회차는 API total=0).
export const FIRST_WIN_SHOP_DRAW = 262;

// 온라인 판매 채널(동행복권 사이트)의 판매점 ID. 배출점 행에 지점처럼 섞여 들어온다.
export const ONLINE_STORE_ID = "51100000";

// 최신 회차 추정용 기준점 (매주 토 20:35 KST 추첨).
const BASE_DRAW = { no: 1237, date: "2026-08-15" };

export function expectedLatestDraw(now = new Date()) {
  const base = new Date(`${BASE_DRAW.date}T20:35:00+09:00`);
  const weeks = Math.floor((now.getTime() - base.getTime()) / (7 * 86400_000));
  return BASE_DRAW.no + Math.max(0, weeks);
}

// fetch(undici) 의 keep-alive 소켓이 쿨다운/DB작업 등 유휴 구간에서 서버측에 끊기고,
// 죽은 소켓 재사용이 fetch failed 로 이어지는 것이 실측됨 (실패 전건이 유휴 직후 첫 요청).
// curl(요청마다 새 연결)은 같은 조건에서 전부 성공 — 그래서 요청마다 새 연결을 쓴다.
function httpGetText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: false, headers: { accept: "application/json" } }, (res) => {
      // 구 endpoint 는 전부 302 로 죽었다 — 200 외 전부(리다이렉트 포함) 실패로 취급.
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.setTimeout(20_000, () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
  });
}

async function getData(path, params, { tries = 8 } = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}?${qs}`;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const json = JSON.parse(await httpGetText(url));
      if (!json || typeof json !== "object" || !("data" in json)) {
        throw new Error("unexpected payload shape");
      }
      return json.data;
    } catch (e) {
      lastErr = e;
      // IP 스로틀(수십 초~수 분 내 해제)도 같은 재시도로 버틴다 — 상한 45s 지수 백오프.
      await sleep(Math.min(1000 * (i + 1) * (i + 1), 45_000) + Math.floor(Math.random() * 1000));
    }
  }
  throw new Error(`dhlottery request failed: ${path}?${qs} — ${lastErr}`);
}

// 회차별 당첨결과. 요청 회차를 상단으로 최대 10개(요청 회차부터 아래로)를 돌려준다.
// 존재하지 않는(미래) 회차를 주면 빈 배열.
export async function fetchDrawWindow(epsd) {
  const data = await getData("/lt645/selectPstLt645InfoNew.do", {
    srchDir: "center",
    srchLtEpsd: epsd,
  });
  return data.list ?? [];
}

// 회차별 1·2등 배출점. 페이징 없이 전건 { total, list }.
export function fetchWins(epsd) {
  return getData("/wnprchsplcsrch/selectLtWnShp.do", {
    srchWnShpRnk: "all",
    srchLtEpsd: epsd,
    srchShpLctn: "",
  });
}

// 전국 판매점 마스터. perPage 는 10 고정으로 동작한다.
export function fetchMasterPage(sido, pageNum) {
  return getData("/prchsplcsrch/selectLtShp.do", {
    srchCtpvNm: sido,
    srchSggNm: "",
    pageNum,
    recordCountPerPage: 10,
  });
}

const ymd = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

export function mapDraw(it) {
  return {
    draw_no: it.ltEpsd,
    draw_date: ymd(String(it.ltRflYmd)),
    n1: it.tm1WnNo, n2: it.tm2WnNo, n3: it.tm3WnNo,
    n4: it.tm4WnNo, n5: it.tm5WnNo, n6: it.tm6WnNo,
    bonus: it.bnsWnNo,
    r1_winners: it.rnk1WnNope, r1_prize_each: it.rnk1WnAmt, r1_prize_total: it.rnk1SumWnAmt,
    r2_winners: it.rnk2WnNope, r2_prize_each: it.rnk2WnAmt, r2_prize_total: it.rnk2SumWnAmt,
    r3_winners: it.rnk3WnNope, r3_prize_each: it.rnk3WnAmt, r3_prize_total: it.rnk3SumWnAmt,
    r4_winners: it.rnk4WnNope, r4_prize_each: it.rnk4WnAmt, r4_prize_total: it.rnk4SumWnAmt,
    r5_winners: it.rnk5WnNope, r5_prize_each: it.rnk5WnAmt, r5_prize_total: it.rnk5SumWnAmt,
    first_auto: it.winType1, first_manual: it.winType2, first_semi: it.winType3,
    sales_total: it.wholEpsdSumNtslAmt,
    prize_pool: it.rlvtEpsdSumNtslAmt,
  };
}

// 배출점 행 → stores 신규 행. 마스터가 더 정확하므로 insert-only 용도로만 쓴다.
export function mapWinStore(w) {
  return {
    store_id: String(w.ltShpId),
    // 과거 회차 일부 지점은 상호가 null 로 온다 — 마스터 동기화가 만나면 실명으로 덮어쓴다.
    name: w.shpNm || "(상호 미상)",
    sido: w.tm1ShpLctnAddr || w.region || null,
    sigungu: w.tm2ShpLctnAddr || null,
    address: (w.shpAddr || "").trim() || null,
    phone: w.shpTelno || null,
    lat: w.shpLat ?? null,
    lng: w.shpLot ?? null,
    status: w.slrOperSttsCd === "1" ? "open" : "closed",
    sells_l645: w.l645LtNtslYn === "Y",
  };
}

// 배출점 행 → store_wins 행. 행 하나 = 당첨 게임 1건.
// atmtPsvYn: Q=자동, M=수동, 과거 회차는 N(미상).
export function mapWinRow(w, draw) {
  return {
    draw_no: draw.draw_no,
    store_id: String(w.ltShpId),
    rank: w.wnShpRnk,
    method: w.atmtPsvYn && w.atmtPsvYn !== "N" ? w.atmtPsvYn : null,
    draw_date: draw.draw_date,
  };
}

export function mapMasterStore(m, seenAtIso) {
  return {
    store_id: String(m.ltShpId),
    name: m.conmNm || "(상호 미상)",
    sido: m.tm1BplcLctnAddr || null,
    sigungu: m.tm2BplcLctnAddr || null,
    address: m.bplcRdnmDaddr || m.bplcLctnDaddr || null,
    phone: m.shpTelno || null,
    lat: m.shpLat ?? null,
    lng: m.shpLot ?? null,
    status: m.slrOperSttsCd === "1" ? "open" : "closed",
    sells_l645: m.l645LtNtslYn === "Y",
    master_seen_at: seenAtIso,
    updated_at: seenAtIso,
  };
}
