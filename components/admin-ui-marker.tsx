"use client";

import { useEffect } from "react";
import { ADMIN_UI_HINT_KEY } from "@/components/site-nav";

// 인증된 어드민 페이지가 렌더될 때 메뉴 노출 힌트를 심는다(로그인 이전에 쿠키만 있던 기기 커버).
// 힌트는 UI 노출용일 뿐 권한이 아니다 — 실제 게이트는 서버의 HttpOnly 쿠키 검증.
export function AdminUiMarker() {
  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_UI_HINT_KEY, "1");
    } catch {
      // ignore
    }
  }, []);
  return null;
}
