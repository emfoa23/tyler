"use client";

import Link from "next/link";
import { BallRow } from "@/components/ball";
import { pickedModeLabel } from "@/lib/lotto";

// 고른 번호 고정 줄 — 헤더(h-14) 바로 아래 sticky. 생성기의 접힌 '번호 고르기' 줄(공 + 지우기)과 같은
// 표현에 생성기로 넘어가는 CTA 를 더했다. 번호 통계 세 뷰 공통(2026-09-07). main 의 좌우 여백(px-4)만큼
// 바깥으로 넓혀 스크롤되는 목록이 줄 아래로 온전히 가려지게 한다. 개수 옆 모드 라벨은 생성기와 같은 규칙.
export function PickedBar({ picked, onClear }: { picked: number[]; onClear: () => void }) {
  return (
    <div className="sticky top-14 z-[5] -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 bg-stone-50/95 px-4 py-2 backdrop-blur">
      <BallRow numbers={picked} size="sm" />
      <span className="text-xs text-stone-400">
        {picked.length}개 · {pickedModeLabel(picked.length)}
      </span>
      <Link
        href={`/generate?picked=${picked.join(",")}`}
        className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-stone-900 transition hover:bg-amber-300"
      >
        이 번호로 뽑기
      </Link>
      <button type="button" onClick={onClear} className="text-xs text-stone-400 hover:underline">
        지우기
      </button>
    </div>
  );
}
