"use client";

import { useRouter } from "next/navigation";
import { SIDO_LIST } from "@/lib/lotto";

const RANK_OPTIONS = [
  { value: "all", label: "1·2등 전체" },
  { value: "1", label: "1등만" },
  { value: "2", label: "2등만" },
];
const MONTHS_OPTIONS = [
  { value: "all", label: "전체 기간" },
  { value: "6", label: "최근 6개월" },
  { value: "12", label: "최근 1년" },
  { value: "60", label: "최근 5년" },
];

const SELECT_CLASS = "rounded-lg border border-stone-200 bg-white px-2 py-1.5";

// 셀렉트 변경 즉시 URL 로 반영한다(적용 버튼 없음). 필터가 바뀌면 page 는 1로 리셋.
export function StoresFilter({ rank, months, sido }: { rank: string; months: string; sido: string }) {
  const router = useRouter();

  const apply = (overrides: Partial<Record<"rank" | "months" | "sido", string>>) => {
    const merged = { rank, months, sido, ...overrides };
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
        value={months}
        onChange={(e) => apply({ months: e.target.value })}
        className={SELECT_CLASS}
      >
        {MONTHS_OPTIONS.map((o) => (
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
