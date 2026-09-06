import { getLatestDraw } from "@/lib/queries";
import {
  MAX_STORE_SITEMAPS, SITE, STORES_PER_SITEMAP, coreEntries, getStoreEntries, historyEntries,
  storeSitemapName, urlsetXml, xmlResponse,
} from "@/lib/sitemap";

// 하위 사이트맵 — core.xml / history.xml / stores-N.xml (lib/sitemap 의 규칙). 인덱스(/sitemap.xml)가 가리킨다.
export const dynamic = "force-static";
export const dynamicParams = false;
// 7일 — 동기화가 경로로 지운다(lib/cache-policy CACHE_TTL_SECONDS 와 동일)
export const revalidate = 604800;

export function generateStaticParams() {
  return [
    { name: "core.xml" },
    { name: "history.xml" },
    ...Array.from({ length: MAX_STORE_SITEMAPS }, (_, i) => ({ name: storeSitemapName(i) })),
  ];
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const latest = await getLatestDraw();
  if (!latest) return xmlResponse(urlsetXml([]));
  if (name === "core.xml") return xmlResponse(urlsetXml(coreEntries(latest)));
  if (name === "history.xml") return xmlResponse(urlsetXml(historyEntries(latest)));
  const m = /^stores-(\d+)\.xml$/.exec(name);
  if (m) {
    const i = Number(m[1]) - 1;
    const stores = await getStoreEntries();
    const part = stores.slice(i * STORES_PER_SITEMAP, (i + 1) * STORES_PER_SITEMAP);
    return xmlResponse(urlsetXml(part.map((s) => ({
      loc: `${SITE}/stores/${s.id}`,
      lastmod: s.lastmod,
      changefreq: "monthly",
      priority: 0.5,
    }))));
  }
  return new Response("not found", { status: 404 });
}
