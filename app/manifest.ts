import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "lottogen — 로또 당첨번호·명당·번호통계",
    short_name: "lottogen",
    description:
      "로또 당첨번호·명당 순위·자주 나오는 번호·번호 생성",
    start_url: "/",
    display: "browser",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
