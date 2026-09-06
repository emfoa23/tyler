import { getLatestDraw } from "@/lib/queries";
import {
  SITE, getStoreEntries, latestChangedDate, sitemapIndexXml, storeChunkCount, storeSitemapName, xmlResponse,
  STORES_PER_SITEMAP,
} from "@/lib/sitemap";

// 사이트맵 인덱스 — 검색엔진에 등록하는 주소는 이것 하나. 하위 파일과 파일별 변경일을 나열한다(lib/sitemap).
export const dynamic = "force-static";
// 7일 — 동기화가 /sitemap.xml 을 경로로 지운다(lib/cache-policy CACHE_TTL_SECONDS 와 동일)
export const revalidate = 604800;

export async function GET() {
  const latest = await getLatestDraw();
  if (!latest) return xmlResponse(sitemapIndexXml([]));
  const weekly = latestChangedDate(latest);
  const stores = await getStoreEntries();
  const chunks = storeChunkCount(stores.length);
  const files = [
    { loc: `${SITE}/sitemaps/core.xml`, lastmod: weekly },
    { loc: `${SITE}/sitemaps/history.xml`, lastmod: weekly },
    ...Array.from({ length: chunks }, (_, i) => {
      const part = stores.slice(i * STORES_PER_SITEMAP, (i + 1) * STORES_PER_SITEMAP);
      const lastmod = part.reduce((m, s) => (s.lastmod > m ? s.lastmod : m), "");
      return { loc: `${SITE}/sitemaps/${storeSitemapName(i)}`, lastmod: lastmod || null };
    }),
  ];
  return xmlResponse(sitemapIndexXml(files));
}
