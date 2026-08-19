import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    // Next 가 "/index" 를 "/" 의 별칭으로 200 서빙해 중복 URL 로 색인될 수 있어 정본으로 몰아준다
    { source: "/index", destination: "/", permanent: true },
  ],
};

export default nextConfig;
