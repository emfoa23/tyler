"use client";

import { useRouter } from "next/navigation";
import { SIDO_LIST } from "@/lib/lotto";

const RANK_OPTIONS = [
  { value: "all", label: "1·2등 전체" },
  { value: "1", label: "1등만" },
  { value: "2", label: "2등만" },
];
const YEARS_OPTIONS = [
  { value: "all", label: "전체 기간" },
  { value: "1", label: "최근 1년" },
  { value: "5", label: "최근 5년" },
];

const SELECT_CLASS = "rounded-lg border border-stone-200 bg-white px-2 py-1.5";

// 셀렉트 변경 즉시 URL 로 반영한다(적용 버튼 없음). 필터가 바뀌면 page 는 1로 리셋.
export function StoresFilter({ rank, years, sido }: { rank: string; years: string; sido: string }) {
  const router = useRouter();

  const apply = (overrides: Partial<Record<"rank" | "years" | "sido", string>>) => {
    const merged = { rank, years, sido, ...overrides };
    const parts = Object.entries(merged)
      .filter(([, v]) => v !== "all")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    router.push(parts.length ? `/stores?${parts.join("&")}` : "/stores");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        aria-label="등수"
        value={rank}
        onChange={(e) => apply({ rank: e.target.value })}
        className={SELECT_CLASS}
      >
        {RANK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        aria-label="기간"
        value={years}
        onChange={(e) => apply({ years: e.target.value })}
        className={SELECT_CLASS}
      >
        {YEARS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        aria-label="지역"
        value={sido}
        onChange={(e) => apply({ sido: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="all">전국</option>
        {SIDO_LIST.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
