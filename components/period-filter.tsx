"use client";

import { useRef, useState } from "react";
import { FilterSelect } from "@/components/filter-select";
import { PERIOD_MAX, PERIOD_OPTIONS, periodValue, type Period } from "@/lib/lotto";

// 기간 셀렉트(전체 · 최근 10·30·50회 · 직접 입력) + 직접 입력일 때만 펼쳐지는 "최근 [N] 회" 입력칸.
// 셀렉트는 바뀌는 즉시, 숫자는 입력을 마쳤을 때(blur·Enter) onChange 로 나간다 — 적용 버튼 없음
// (다른 셀렉트 필터와 같은 규칙). 단위는 회차 하나(lib/lotto Period).
export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const preset = periodValue(value);
  const [custom, setCustom] = useState(preset === "custom");
  const [draft, setDraft] = useState(preset === "custom" && value ? String(value) : "");
  const lastCommitted = useRef<Period>(value);
  const showCustom = custom || preset === "custom";

  function commit() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1 || n > PERIOD_MAX) return;
    if (n === lastCommitted.current) return; // Enter 뒤 blur 처럼 같은 값이 연달아 오는 경우
    lastCommitted.current = n;
    onChange(n);
  }

  function onSelect(v: string) {
    if (v === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    const next: Period = v === "all" ? null : Number(v);
    lastCommitted.current = next;
    onChange(next);
  }

  return (
    <>
      <FilterSelect label="기간" value={showCustom ? "custom" : preset} options={PERIOD_OPTIONS} onChange={onSelect} />
      {showCustom && (
        <span className="flex items-center gap-1">
          <span className="text-stone-500">최근</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={PERIOD_MAX}
            value={draft}
            aria-label="최근 몇 회"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                e.currentTarget.blur();
              }
            }}
            className="w-16 rounded-lg border border-stone-200 bg-white px-2 py-1.5"
          />
          <span className="text-stone-500">회</span>
        </span>
      )}
    </>
  );
}
