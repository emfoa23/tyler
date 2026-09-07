import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { NumberStatList } from "@/components/number-stat-list";
import { NumbersFilter } from "@/components/numbers-filter";
import { SectionTabs } from "@/components/section-tabs";
import { dateShort } from "@/lib/format";
import { NUMBERS_TABS, parsePeriod, periodDraws, withCompetitionRank } from "@/lib/lotto";
import { getLatestDraw, getNumberFrequency } from "@/lib/queries";

// 검색 파라미터(searchParams)를 읽어 Next 가 요청마다 렌더하는 화면 — 페이지 캐시 대신 조회 결과를
// 태그 데이터 캐시(lib/queries, lib/cache-policy)에 7일 보관하고 동기화가 태그로 지운다.

export const metadata: Metadata = pageMeta({
  core: "로또 자주 나오는 번호",
  description: "흐름을 보고 이번 주 조합을 골라보세요",
  path: "/numbers",
});

type Params = { draws?: string; months?: string; bonus?: string };

export default async function NumbersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params);
  const bonus = params.bonus === "1";

  // 기간 창 = 최근 N회 (구 months= 링크는 parsePeriod 가 환산, 최신 회차 이상은 전체 — lib/lotto)
  const latest = await getLatestDraw();
  const rows = await getNumberFrequency({ draws: periodDraws(period, latest?.draw_no ?? 0), bonus });
  const maxCnt = rows[0]?.cnt || 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">로또 자주 나오는 번호</h1>

      <SectionTabs tabs={NUMBERS_TABS} current="/numbers" />

      <NumbersFilter basePath="/numbers" period={period} bonus={bonus ? "1" : "0"} />

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
