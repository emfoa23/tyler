"use client";

import { ballColor } from "@/lib/lotto";

// 1~45 번호 그리드 — 생성기 '번호 고르기'와 같이 나온 번호가 공유한다. 고른 번호는 공 색으로 칠한다.
export function NumberPicker({
  picked,
  onToggle,
  className = "",
}: {
  picked: number[];
  onToggle: (n: number) => void;
  className?: string;
}) {
  return (
    <div className={`mx-auto grid w-fit grid-cols-9 gap-1 ${className}`}>
      {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
        const on = picked.includes(n);
        return (
          <button
            key={n}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(n)}
            className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition ${
              on ? "text-white" : "border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            }`}
            style={on ? { backgroundColor: ballColor(n), textShadow: "0 1px 1px rgba(0,0,0,.3)" } : undefined}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
