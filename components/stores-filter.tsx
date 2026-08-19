"use client";

import { useRouter } from "next/navigation";
import { FilterSelect } from "@/components/filter-select";
import { MONTHS_OPTIONS, SIDO_LIST } from "@/lib/lotto";

const RANK_OPTIONS = [
  { value: "all", label: "1·2등 전체" },
  { value: "1", label: "1등만" },
  { value: "2", label: "2등만" },
];
const SIDO_OPTIONS = [{ value: "all", label: "전국" }, ...SIDO_LIST.map((s) => ({ value: s, label: s }))];

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
      <FilterSelect label="등수" value={rank} options={RANK_OPTIONS} onChange={(v) => apply({ rank: v })} />
      <FilterSelect label="기간" value={months} options={MONTHS_OPTIONS} onChange={(v) => apply({ months: v })} />
      <FilterSelect label="지역" value={sido} options={SIDO_OPTIONS} onChange={(v) => apply({ sido: v })} />
    </div>
  );
}
