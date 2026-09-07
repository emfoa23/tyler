"use client";

import { useRouter } from "next/navigation";
import { FilterSelect } from "@/components/filter-select";
import { PeriodFilter } from "@/components/period-filter";
import { periodParam, type Period } from "@/lib/lotto";

const BONUS_OPTIONS = [
  { value: "0", label: "본번호만" },
  { value: "1", label: "보너스 포함" },
];

// 셀렉트 변경 즉시 URL 로 반영한다(적용 버튼 없음).
// period 를 안 주면(안나온 번호·같이 나온 번호 뷰 — 기간 개념이 없거나 전 기간 고정) 집계 대상 셀렉트만 노출한다.
// keep 은 뷰가 유지해야 하는 파라미터(같이 나온 번호의 with=1,18) — 값은 호출자가 URL 안전한 형태로 준다.
export function NumbersFilter({
  basePath,
  period,
  bonus,
  keep,
}: {
  basePath: string;
  period?: Period;
  bonus: string;
  keep?: Record<string, string | undefined>;
}) {
  const router = useRouter();

  const apply = (next: { period?: Period; bonus?: string }) => {
    const merged = { period, bonus, ...next };
    const parts: string[] = [];
    for (const [k, v] of Object.entries(keep ?? {})) if (v) parts.push(`${k}=${v}`);
    const p = merged.period === undefined ? null : periodParam(merged.period);
    if (p) parts.push(p);
    if (merged.bonus === "1") parts.push("bonus=1");
    router.push(parts.length ? `${basePath}?${parts.join("&")}` : basePath);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {period !== undefined && <PeriodFilter value={period} onChange={(p) => apply({ period: p })} />}
      <FilterSelect label="집계 대상" value={bonus} options={BONUS_OPTIONS} onChange={(v) => apply({ bonus: v })} />
    </div>
  );
}
