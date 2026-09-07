import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버 전용 — 같은 와이파이의 폰(192.168.x.x)에서 `next dev -H 0.0.0.0` 에 접속할 때 Next 가 /_next/* 청크·HMR 을
  // 교차 출처로 막아 hydration 이 안 되므로(셀렉트·버튼이 반응 없음) LAN 대역을 허용한다. 프로덕션 동작엔 영향 없음.
  allowedDevOrigins: ["192.168.*.*"],
  redirects: async () => [
    // Next 가 "/index" 를 "/" 의 별칭으로 200 서빙해 중복 URL 로 색인될 수 있어 정본으로 몰아준다
    { source: "/index", destination: "/", permanent: true },
  ],
};

export default nextConfig;
