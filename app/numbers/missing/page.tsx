import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { NumberStatList } from "@/components/number-stat-list";
import { NumbersFilter } from "@/components/numbers-filter";
import { SectionTabs } from "@/components/section-tabs";
import { dateShort } from "@/lib/format";
import { NUMBERS_TABS, rankByMissed } from "@/lib/lotto";
import { getLatestDraw, getNumberFrequency } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  core: "로또 안나온 번호",
  description: "오래 잠든 공을 깨워보세요",
  path: "/numbers/missing",
});

type Params = { bonus?: string };

export default async function MissingNumbersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const bonus = params.bonus === "1";

  // 전 기간 조회 — 미출현 회차수는 마지막 출현 기준이라 기간 필터가 없다 (rankByMissed 참조)
  const [latest, rows] = await Promise.all([getLatestDraw(), getNumberFrequency({ bonus })]);
  const ranked = rankByMissed(rows, latest?.draw_no ?? 0);
  const maxMissed = ranked[0]?.missed || 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">로또 안나온 번호</h1>

      <SectionTabs tabs={NUMBERS_TABS} current="/numbers/missing" />

      <NumbersFilter basePath="/numbers/missing" bonus={bonus ? "1" : "0"} />

      <NumberStatList
        items={ranked.map((r) => ({
          num: r.num,
          ratio: r.missed / maxMissed,
          primary: `${r.missed}회째`,
          secondary: r.last_draw ? `최근 ${dateShort(r.last_date!)}` : "출현 없음",
        }))}
      />

    </div>
  );
}
