import type { MetadataRoute } from "next";
import { getLatestDraw } from "@/lib/queries";

export const revalidate = 86400;

// 지점 페이지(수만 개)는 의도적으로 제외 — per-id 페이지를 사이트맵에 다 실으면
// 크롤러가 ISR 재생성을 폭증시킨다 (boss-paegi 에서 실측된 함정). 랭킹 페이지 링크로 발견되게 둔다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://lottogen.click";
  const latest = await getLatestDraw();

  const core: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/generate`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/history`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/stores`, changeFrequency: "weekly", priority: 0.8 },
  ];

  const draws: MetadataRoute.Sitemap = latest
    ? Array.from({ length: latest.draw_no }, (_, i) => ({
        url: `${base}/history/${i + 1}`,
        changeFrequency: "yearly" as const,
        priority: 0.4,
      }))
    : [];

  return [...core, ...draws];
}
