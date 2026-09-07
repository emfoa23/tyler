"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ball } from "@/components/ball";
import { NumberPicker } from "@/components/number-picker";
import { PagedList } from "@/components/paged-list";
import { PickedBar } from "@/components/picked-bar";

export type NumberStatItem = {
  rank: number; // 표준 경쟁 순위 — 동률은 같은 번호(withCompetitionRank)
  num: number;
  ratio: number; // 막대 길이 (0~1, 뷰의 최댓값 대비)
  primary: string;
  secondary: string;
};

// 번호 통계 공통 리스트 템플릿 (자주 나오는·안나온·같이 나온 번호) — 순위·볼·막대·우측 수치 2줄.
// 행을 누르면 그 번호가 골라지고, 고른 번호는 위쪽 고정 줄(PickedBar)에 모여 생성기로 넘어간다(2026-09-07).
//   mode "local": 고른 번호는 이 화면 안의 상태 — 탭을 옮기면 초기화된다.
//   mode "url"  : 고른 번호 = with 파라미터(같이 나온 번호). 고른 번호가 곧 조건이라 누를 때마다 주소가 바뀌고
//                 서버가 다시 조회한다. grid 는 첫 선택용 45개 그리드(생성기와 같은 컴포넌트).
export function NumberStatList({
  items,
  mode = "local",
  picked = [],
  basePath = "",
  query = {},
  grid = false,
  header,
  hint,
}: {
  items: NumberStatItem[];
  mode?: "local" | "url";
  picked?: number[];
  basePath?: string;
  query?: Record<string, string | undefined>;
  grid?: boolean;
  header?: React.ReactNode;
  hint?: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<number[]>([]);
  const selected = mode === "url" ? picked : local;

  function hrefWith(nums: number[]): string {
    const parts: string[] = [];
    if (nums.length) parts.push(`with=${nums.join(",")}`);
    for (const [k, v] of Object.entries(query)) if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
    return parts.length ? `${basePath}?${parts.join("&")}` : basePath;
  }

  const toggled = (prev: number[], n: number) =>
    prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b);

  // local 은 함수형 갱신 — 연달아 누른 탭이 같은 렌더의 값을 덮어쓰지 않게
  function toggle(n: number) {
    if (mode === "url") router.push(hrefWith(toggled(picked, n)));
    else setLocal((prev) => toggled(prev, n));
  }

  function clear() {
    if (mode === "url") router.push(hrefWith([]));
    else setLocal([]);
  }

  return (
    <>
      {grid && <NumberPicker picked={selected} onToggle={toggle} />}
      {selected.length > 0 && <PickedBar picked={selected} onClear={clear} />}
      {header}
      {items.length ? (
        <PagedList
          pageSize={10}
          className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4"
          items={items.map((r) => {
            const on = selected.includes(r.num);
            return (
              <li key={r.num}>
                {/* 카드의 px-4 안쪽에서 선택 배경이 가장자리까지 닿도록 행 버튼을 그만큼 넓힌다 */}
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(r.num)}
                  className={`-mx-4 flex w-[calc(100%+2rem)] items-center gap-3 px-4 py-2.5 text-left ${
                    on ? "bg-amber-50" : "hover:bg-stone-50"
                  }`}
                >
                  <span className="w-6 shrink-0 text-center text-sm font-bold text-stone-400">
                    {r.rank}
                  </span>
                  <span className={on ? "rounded-full ring-2 ring-amber-400 ring-offset-1" : ""}>
                    <Ball n={r.num} size="md" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block h-2 rounded-full bg-stone-100">
                      <span
                        className="block h-2 rounded-full bg-amber-400"
                        style={{ width: `${r.ratio * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right">
                    <span className="block text-sm font-semibold">{r.primary}</span>
                    <span className="block text-xs text-stone-400">{r.secondary}</span>
                  </span>
                </button>
              </li>
            );
          })}
        />
      ) : (
        hint && (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">{hint}</p>
        )
      )}
    </>
  );
}
