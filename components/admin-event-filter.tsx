"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilterSelect } from "@/components/filter-select";
import { EVENT_KINDS, KIND_KO, isEventKind, type EventKind } from "@/lib/admin-labels";
import { UUID_RE, eventsHref } from "@/lib/admin-events-url";

const KIND_OPTIONS = [{ value: "all", label: "전체" }, ...EVENT_KINDS.map((k) => ({ value: k, label: KIND_KO[k] }))];

// 원본 이벤트 필터 — 종류는 셀렉트 변경 즉시 반영(명당 순위·번호 통계 규약), 기기 ID 는 입력 후 Enter/포커스 아웃.
// 필터가 바뀌면 page 는 1로 리셋. 기기 ID 는 UUID 전체만(카드의 기기 ID 를 누르면 채워진 채로 온다).
export function EventFilters({ kind, clientId }: { kind: EventKind | null; clientId: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState(clientId ?? "");
  const [invalid, setInvalid] = useState(false);

  const applyClient = (raw: string) => {
    const v = raw.trim().toLowerCase();
    if (v && !UUID_RE.test(v)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if ((v || null) === clientId) return;
    router.push(eventsHref({ kind, clientId: v || null, page: 1 }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <FilterSelect
        label="이벤트 종류"
        value={kind ?? "all"}
        options={KIND_OPTIONS}
        onChange={(v) => router.push(eventsHref({ kind: isEventKind(v) ? v : null, clientId, page: 1 }))}
      />
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          applyClient(draft);
        }}
      >
        <input
          aria-label="기기 ID"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => applyClient(draft)}
          placeholder="기기 ID(UUID)"
          spellCheck={false}
          autoComplete="off"
          className={`w-[17rem] max-w-full rounded-lg border bg-white px-2 py-1.5 font-mono text-xs ${
            invalid ? "border-red-300" : "border-stone-200"
          }`}
        />
        {clientId && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              applyClient("");
            }}
            className="whitespace-nowrap rounded-lg px-2 py-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            해제
          </button>
        )}
      </form>
      {invalid && <span className="text-xs text-red-500">UUID 전체를 입력해요</span>}
    </div>
  );
}
