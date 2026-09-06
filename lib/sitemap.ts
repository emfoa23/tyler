// 사이트맵 인덱스 + 하위 파일 생성기 (2026-09-06). 정본 규칙:
//   /sitemap.xml            인덱스 — 하위 파일 목록과 파일별 변경일
//   /sitemaps/core.xml      공개 페이지 8 + 시도별 명당 순위 17 (변경일 = 매주 바뀌는 것은 최신 회차 완성일)
//   /sitemaps/history.xml   회차 1..최신 (변경일 = 추첨일, 최신 회차만 완성 시각)
//   /sitemaps/stores-N.xml  배출 이력이 있는 지점(내용이 있는 페이지만) 5,000개씩 (변경일 = 마지막 배출일·마스터 변경일 중 늦은 쪽)
// 세 파일 모두 7일 캐시 + 동기화가 경로로 지운다(scripts/lib/changes.mjs FEED_PATHS). 검색엔진에는 인덱스 주소 하나만 등록한다.
import { db } from "./db";
import { SIDO_LIST, drawDateFor } from "./lotto";
import type { Draw } from "./types";

export const SITE = "https://lottogen.click";
export const STORES_PER_SITEMAP = 5000;
export const MAX_STORE_SITEMAPS = 4; // 2만 지점 여유 — generateStaticParams 가 고정 이름을 내야 해서 상한을 둔다

export type UrlEntry = { loc: string; lastmod?: string | null; changefreq?: string; priority?: number };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function urlsetXml(entries: UrlEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`<loc>${esc(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`<priority>${e.priority}</priority>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(files: { loc: string; lastmod?: string | null }[]): string {
  const body = files
    .map((f) => `<sitemap><loc>${esc(f.loc)}</loc>${f.lastmod ? `<lastmod>${f.lastmod}</lastmod>` : ""}</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export const xmlResponse = (xml: string) =>
  new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });

/** 최신 회차의 "완성일"(YYYY-MM-DD, KST) — 매주 바뀌는 페이지들의 변경일. 완성 전이면 추첨일. */
export function latestChangedDate(latest: Pick<Draw, "draw_date" | "completed_at">): string {
  if (!latest.completed_at) return latest.draw_date;
  return new Date(latest.completed_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function coreEntries(latest: Draw): UrlEntry[] {
  const weekly = latestChangedDate(latest);
  return [
    { loc: SITE, lastmod: weekly, changefreq: "weekly", priority: 1 },
    { loc: `${SITE}/generate`, changefreq: "monthly", priority: 0.9 },
    { loc: `${SITE}/history`, lastmod: weekly, changefreq: "weekly", priority: 0.8 },
    { loc: `${SITE}/stores`, lastmod: weekly, changefreq: "weekly", priority: 0.8 },
    { loc: `${SITE}/numbers`, lastmod: weekly, changefreq: "weekly", priority: 0.8 },
    { loc: `${SITE}/numbers/missing`, lastmod: weekly, changefreq: "weekly", priority: 0.7 },
    { loc: `${SITE}/about`, changefreq: "yearly", priority: 0.3 },
    { loc: `${SITE}/privacy`, changefreq: "yearly", priority: 0.3 },
    // 지역별 명당 순위 — 별도 페이지 없이 ?sido= 변형을 자기 canonical 로 색인("서울 로또 명당 순위")
    ...SIDO_LIST.map((sido) => ({
      loc: `${SITE}/stores?sido=${encodeURIComponent(sido)}`,
      lastmod: weekly,
      changefreq: "weekly",
      priority: 0.6,
    })),
  ];
}

export function historyEntries(latest: Draw): UrlEntry[] {
  const latestDate = latestChangedDate(latest);
  return Array.from({ length: latest.draw_no }, (_, i) => {
    const n = i + 1;
    return {
      loc: `${SITE}/history/${n}`,
      // 과거 회차는 추첨일 이후 사실상 불변 — 추첨일을 변경일로 써서 재크롤을 줄인다. 최신 회차만 완성일.
      lastmod: n === latest.draw_no ? latestDate : drawDateFor(latest, n),
      changefreq: n === latest.draw_no ? "weekly" : "yearly",
      priority: n === latest.draw_no ? 0.7 : 0.4,
    };
  });
}

export type StoreEntry = { id: string; lastmod: string };

/** 배출 이력이 있는 지점과 변경일 — SQL 함수가 json 한 덩어리로 돌려준다(1,000행 한도 우회). */
export async function getStoreEntries(): Promise<StoreEntry[]> {
  const { data, error } = await db.rpc("sitemap_store_entries");
  if (error) throw error;
  return (data ?? []) as StoreEntry[];
}

export const storeChunkCount = (n: number) =>
  Math.min(MAX_STORE_SITEMAPS, Math.max(1, Math.ceil(n / STORES_PER_SITEMAP)));

export const storeSitemapName = (i: number) => `stores-${i + 1}.xml`;
