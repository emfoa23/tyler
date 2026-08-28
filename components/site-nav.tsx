"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 운영자 UI 힌트(localStorage) — 로그인 성공/어드민 렌더 시 심는 표시일 뿐, 권한이 아니다
// (실제 게이트는 /admin 의 HttpOnly 쿠키 검증). 힌트만 있으면 메뉴 맨위에 '운영 통계'를 노출한다.
export const ADMIN_UI_HINT_KEY = "tyler_admin_ui";
const ADMIN_ITEM = { href: "/admin", label: "운영 통계" };

const NAV = [
  { href: "/generate", label: "번호 생성" },
  { href: "/history", label: "당첨 결과" },
  { href: "/stores", label: "명당 순위" },
  { href: "/numbers", label: "번호 통계" },
];
// 드로어에만 두는 보조 메뉴
const DRAWER_EXTRA = [{ href: "/about", label: "서비스 소개" }];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// sm 미만은 햄버거 드로어, sm 이상은 인라인 — 메뉴 4개부터 375px 인라인이 깨져서 분기한다.
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    try {
      setShowAdmin(localStorage.getItem(ADMIN_UI_HINT_KEY) === "1");
    } catch {
      // storage 불가 환경 — 미노출
    }
  }, []);

  const items = showAdmin ? [ADMIN_ITEM, ...NAV] : NAV;

  return (
    <>
      <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-2.5 py-1.5 hover:bg-stone-100 hover:text-stone-900 ${
              isActive(pathname, item.href) ? "text-stone-900" : "text-stone-600"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 sm:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {/* 헤더의 backdrop-blur 가 fixed 의 containing block 을 헤더로 만들므로 body 로 portal.
          전체 드로어 대신 버튼 아래 말풍선 크기의 팝오버만 띄운다. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
          />
          <nav className="absolute right-3 top-14 flex w-40 flex-col rounded-xl border border-stone-200 bg-white p-1.5 text-sm font-medium shadow-lg">
            {[...items, ...DRAWER_EXTRA].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 hover:bg-stone-100 ${
                  isActive(pathname, item.href)
                    ? "bg-stone-50 font-bold text-stone-900"
                    : "text-stone-600"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
