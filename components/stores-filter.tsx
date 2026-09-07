"use client";

import { useRouter } from "next/navigation";
import { FilterCheckbox } from "@/components/filter-checkbox";
import { FilterSelect } from "@/components/filter-select";
import { PeriodFilter } from "@/components/period-filter";
import { SIDO_LIST, periodParam, type Period } from "@/lib/lotto";

const RANK_OPTIONS = [
  { value: "all", label: "1·2등 전체" },
  { value: "1", label: "1등만" },
  { value: "2", label: "2등만" },
];
const SIDO_OPTIONS = [{ value: "all", label: "전국" }, ...SIDO_LIST.map((s) => ({ value: s, label: s }))];

// 셀렉트·체크박스 변경 즉시 URL 로 반영한다(적용 버튼 없음). 필터가 바뀌면 page 는 1로 리셋.
// open = 폐점 제외(open=1) — 판매점 검색의 같은 체크박스와 동일 파라미터.
export function StoresFilter({
  rank,
  period,
  sido,
  open,
}: {
  rank: string;
  period: Period;
  sido: string;
  open: boolean;
}) {
  const router = useRouter();

  const apply = (next: { rank?: string; period?: Period; sido?: string; open?: boolean }) => {
    const merged = { rank, period, sido, open, ...next };
    const parts: string[] = [];
    if (merged.rank !== "all") parts.push(`rank=${merged.rank}`);
    const p = periodParam(merged.period);
    if (p) parts.push(p);
    if (merged.sido !== "all") parts.push(`sido=${encodeURIComponent(merged.sido)}`);
    if (merged.open) parts.push("open=1");
    router.push(parts.length ? `/stores?${parts.join("&")}` : "/stores");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <FilterSelect label="등수" value={rank} options={RANK_OPTIONS} onChange={(v) => apply({ rank: v })} />
      <PeriodFilter value={period} onChange={(p) => apply({ period: p })} />
      <FilterSelect label="지역" value={sido} options={SIDO_OPTIONS} onChange={(v) => apply({ sido: v })} />
      <FilterCheckbox label="폐점 제외" checked={open} onChange={(v) => apply({ open: v })} />
    </div>
  );
}
