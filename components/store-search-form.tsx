"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilterCheckbox } from "@/components/filter-checkbox";
import { STORE_SEARCH_MAX } from "@/lib/lotto";

// 상호·주소 검색창 — 검색어는 제출(Enter·검색 버튼)로, 폐점 제외 체크박스는 바뀌는 즉시 URL 에 반영한다.
// 지역 필터는 두지 않는다(주소에 지역명을 치면 된다). open=1 은 명당 순위의 같은 체크박스와 동일 파라미터.
export function StoreSearchForm({ q, open }: { q: string; open: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(q);

  const go = (nextQ: string, nextOpen: boolean) => {
    const parts: string[] = [];
    if (nextQ) parts.push(`q=${encodeURIComponent(nextQ)}`);
    if (nextOpen) parts.push("open=1");
    router.push(parts.length ? `/stores/search?${parts.join("&")}` : "/stores/search");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(draft.trim(), open);
      }}
      className="flex items-center gap-2 text-sm"
    >
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="상호 또는 주소"
        aria-label="상호 또는 주소"
        maxLength={STORE_SEARCH_MAX}
        enterKeyHint="search"
        className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5"
      />
      <FilterCheckbox label="폐점 제외" checked={open} onChange={(v) => go(draft.trim(), v)} />
      <button type="submit" className="shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 font-medium text-white hover:bg-stone-700">
        검색
      </button>
    </form>
  );
}
