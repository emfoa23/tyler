"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackGenerateView, trackVisit } from "@/lib/analytics-client";

// 전역 방문·이용 통계 비콘(집계 전용) — layout 에 마운트, 렌더 없음.
// 방문은 탭 세션당 1회(최초 랜딩 기준), 생성기 진입은 경로 감지로 탭 세션당 1회.
export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    trackVisit(pathname);
    if (pathname === "/generate" || pathname.startsWith("/generate/")) {
      trackGenerateView();
    }
  }, [pathname]);

  return null;
}
