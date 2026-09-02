import type { MetadataRoute } from "next";
import { SIDO_LIST, drawDateFor } from "@/lib/lotto";
import { getLatestDraw } from "@/lib/queries";

export const revalidate = 86400;

// 지점 페이지(수만 개)는 의도적으로 제외 — per-id 페이지를 사이트맵에 다 실으면
// 크롤러가 ISR 재생성을 폭증시킨다 (boss-paegi 에서 실측된 함정). 순위 페이지 링크로 발견되게 둔다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://lottogen.click";
  const latest = await getLatestDraw();

  const core: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1, lastModified: latest?.draw_date },
    { url: `${base}/generate`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/history`, changeFrequency: "weekly", priority: 0.8, lastModified: latest?.draw_date },
    { url: `${base}/stores`, changeFrequency: "weekly", priority: 0.8, lastModified: latest?.draw_date },
    { url: `${base}/numbers`, changeFrequency: "weekly", priority: 0.8, lastModified: latest?.draw_date },
    { url: `${base}/numbers/missing`, changeFrequency: "weekly", priority: 0.7, lastModified: latest?.draw_date },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // 지역별 명당 순위 — 별도 페이지 없이 ?sido= 변형을 자기 canonical 로 색인(“서울 로또 명당 순위”).
  const sidoStores: MetadataRoute.Sitemap = SIDO_LIST.map((sido) => ({
    url: `${base}/stores?sido=${encodeURIComponent(sido)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
    lastModified: latest?.draw_date,
  }));

  const draws: MetadataRoute.Sitemap = latest
    ? Array.from({ length: latest.draw_no }, (_, i) => ({
        url: `${base}/history/${i + 1}`,
        changeFrequency: "yearly" as const,
        priority: 0.4,
        // 과거 회차 내용은 추첨일 이후 사실상 불변 — 추첨일을 lastmod 로 써서 재크롤을 줄인다
        lastModified: drawDateFor(latest, i + 1),
      }))
    : [];

  return [...core, ...sidoStores, ...draws];
}
