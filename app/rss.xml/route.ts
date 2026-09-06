import { db } from "@/lib/db";
import { isPrizePublished } from "@/lib/draw-state.mjs";
import { dateShort, wonShort } from "@/lib/format";
import { drawNumbers, methodLabel } from "@/lib/lotto";
import { SITE } from "@/lib/sitemap";
import type { Draw } from "@/lib/types";

// RSS 2.0 — "최근에 완성된 문서" 목록. 항목은 기존 페이지를 가리키는 목차일 뿐 새 페이지를 만들지 않는다.
//   회차 항목: 최근 8회차(완성된 회차만 — completed_at 이 있는 것), 날짜 = 완성 시각
//   배출 지점 항목: 최근 2회차의 1·2등 배출 지점(지점당 회차별 1건), 날짜 = 그 회차 완성 시각
// 네이버 RSS 제출·구글 사이트맵(피드 형식) 양쪽에 같은 주소를 등록한다. 7일 캐시 + 동기화가 /rss.xml 을 지운다.
export const dynamic = "force-static";
export const revalidate = 604800;

const ROUNDS = 8;
const STORE_ROUNDS = 2;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (iso: string) => new Date(iso).toUTCString();

type WinRow = {
  draw_no: number;
  rank: 1 | 2;
  method: string | null;
  store: { store_id: string; name: string; sido: string | null; sigungu: string | null } | null;
};

type Item = { title: string; link: string; guid: string; pubDate: string; description: string };

function roundItem(d: Draw): Item {
  const nums = `${drawNumbers(d).join("·")} + ${d.bonus}`;
  const prize = isPrizePublished(d) && d.r1_winners !== null
    ? ` · 1등 ${d.r1_winners.toLocaleString("ko-KR")}명 각 ${wonShort(d.r1_prize_each)}`
    : "";
  return {
    title: `로또 ${d.draw_no}회 당첨번호 (${dateShort(d.draw_date)} 추첨)`,
    link: `${SITE}/history/${d.draw_no}`,
    guid: `${SITE}/history/${d.draw_no}`,
    pubDate: rfc822(d.completed_at ?? `${d.draw_date}T20:35:00+09:00`),
    description: `당첨번호 ${nums}${prize} · 1·2등 배출점 목록`,
  };
}

function storeItems(rows: WinRow[], completedAt: Map<number, string>): Item[] {
  // (회차, 지점) 단위로 합산 — 같은 지점이 한 회차에 여러 게임을 배출하면 인원·방식을 병기
  const byKey = new Map<string, { row: WinRow; count: number; methods: Map<string, number> }>();
  for (const r of rows) {
    if (!r.store) continue;
    const key = `${r.draw_no}:${r.store.store_id}`;
    const e = byKey.get(key) ?? { row: r, count: 0, methods: new Map() };
    e.count += 1;
    const label = methodLabel(r.method);
    if (label) e.methods.set(label, (e.methods.get(label) ?? 0) + 1);
    byKey.set(key, e);
  }
  return [...byKey.values()].map(({ row, count, methods }) => {
    const s = row.store!;
    const where = [s.sido, s.sigungu].filter(Boolean).join(" ");
    const method = [...methods].map(([m, c]) => (c > 1 ? `${m} ${c}` : m)).join(" · ");
    return {
      title: `${row.draw_no}회 ${row.rank}등 배출점 ${s.name}${where ? ` (${where})` : ""}`,
      link: `${SITE}/stores/${s.store_id}`,
      guid: `${SITE}/stores/${s.store_id}#${row.draw_no}`,
      pubDate: rfc822(completedAt.get(row.draw_no) ?? new Date().toISOString()),
      description: `${row.draw_no}회 ${row.rank}등 ${count}명${method ? ` · ${method}` : ""}`,
    };
  });
}

export async function GET() {
  const { data: rounds, error } = await db
    .from("draws").select("*")
    .not("completed_at", "is", null)
    .order("draw_no", { ascending: false })
    .limit(ROUNDS);
  if (error) throw error;
  const draws = (rounds ?? []) as Draw[];
  const recent = draws.slice(0, STORE_ROUNDS).map((d) => d.draw_no);
  const { data: wins, error: e2 } = recent.length
    ? await db
        .from("store_wins")
        .select("draw_no, rank, method, store:stores(store_id, name, sido, sigungu)")
        .in("draw_no", recent)
        .order("draw_no", { ascending: false })
        .order("rank", { ascending: true })
        .order("store_id", { ascending: true })
    : { data: [], error: null };
  if (e2) throw e2;
  const completedAt = new Map(draws.map((d) => [d.draw_no, d.completed_at ?? `${d.draw_date}T20:35:00+09:00`]));
  const items = [...draws.map(roundItem), ...storeItems((wins ?? []) as unknown as WinRow[], completedAt)];
  const lastBuild = draws[0]?.completed_at ? rfc822(draws[0].completed_at) : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>lottogen 로또 당첨 결과</title>
<link>${SITE}</link>
<description>회차별 로또 6/45 당첨번호와 1·2등 배출점 — 매주 토요일 추첨 결과가 완성되면 갱신</description>
<language>ko</language>
<lastBuildDate>${lastBuild}</lastBuildDate>
<atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
${items.map((it) => `<item><title>${esc(it.title)}</title><link>${esc(it.link)}</link><guid isPermaLink="false">${esc(it.guid)}</guid><pubDate>${it.pubDate}</pubDate><description>${esc(it.description)}</description></item>`).join("\n")}
</channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
