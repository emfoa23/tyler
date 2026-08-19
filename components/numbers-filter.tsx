"use client";

import { useRouter } from "next/navigation";
import { FilterSelect } from "@/components/filter-select";
import { MONTHS_OPTIONS } from "@/lib/lotto";

const BONUS_OPTIONS = [
  { value: "0", label: "본번호만" },
  { value: "1", label: "보너스 포함" },
];

// 셀렉트 변경 즉시 URL 로 반영한다(적용 버튼 없음).
export function NumbersFilter({ months, bonus }: { months: string; bonus: string }) {
  const router = useRouter();

  const apply = (overrides: Partial<Record<"months" | "bonus", string>>) => {
    const merged = { months, bonus, ...overrides };
    const parts: string[] = [];
    if (merged.months !== "all") parts.push(`months=${merged.months}`);
    if (merged.bonus === "1") parts.push("bonus=1");
    router.push(parts.length ? `/numbers?${parts.join("&")}` : "/numbers");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <FilterSelect label="기간" value={months} options={MONTHS_OPTIONS} onChange={(v) => apply({ months: v })} />
      <FilterSelect label="집계 대상" value={bonus} options={BONUS_OPTIONS} onChange={(v) => apply({ bonus: v })} />
    </div>
  );
}
