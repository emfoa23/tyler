import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { NumberStatList } from "@/components/number-stat-list";
import { NumbersFilter } from "@/components/numbers-filter";
import { SectionTabs } from "@/components/section-tabs";
import { dateShort } from "@/lib/format";
import { NUMBERS_TABS, withCompetitionRank } from "@/lib/lotto";
import { getNumberFrequency } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  core: "로또 자주 나오는 번호",
  description: "흐름을 보고 이번 주 조합을 골라보세요",
  path: "/numbers",
});

type Params = { months?: string; bonus?: string };

export default async function NumbersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const months = ["6", "12", "60"].includes(params.months ?? "") ? Number(params.months) : null;
  const bonus = params.bonus === "1";

  const rows = await getNumberFrequency({ months, bonus });
  const maxCnt = rows[0]?.cnt || 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">로또 자주 나오는 번호</h1>

      <SectionTabs tabs={NUMBERS_TABS} current="/numbers" />

      <NumbersFilter basePath="/numbers" months={months ? String(months) : "all"} bonus={bonus ? "1" : "0"} />

      <NumberStatList
        items={withCompetitionRank(rows, (r) => r.cnt).map((r) => ({
          rank: r.rank,
          num: r.num,
          ratio: r.cnt / maxCnt,
          primary: `${r.cnt.toLocaleString("ko-KR")}회`,
          secondary: r.last_draw ? `최근 ${dateShort(r.last_date!)}` : "출현 없음",
        }))}
      />

    </div>
  );
}
