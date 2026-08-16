"use client";

import { useState } from "react";

// 긴 목록(배출점·배출 이력)의 클라이언트 페이징.
// 데이터는 서버 렌더에 이미 포함돼 있고 표시만 나눈다 — ISR 캐시를 깨지 않기 위한 선택.
export function PagedList({
  items,
  pageSize = 10,
  className,
}: {
  items: React.ReactNode[];
  pageSize?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(pageSize);
  const remaining = items.length - shown;
  return (
    <>
      <ul className={className}>{items.slice(0, shown)}</ul>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShown(shown + pageSize)}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          더 보기 ({remaining}건 남음)
        </button>
      )}
    </>
  );
}
