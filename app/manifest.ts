import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "lottogen — 로또 번호 생성기",
    short_name: "lottogen",
    description:
      "로또 6/45 번호 생성, 회차별 당첨 결과, 1·2등 배출 명당 랭킹",
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
