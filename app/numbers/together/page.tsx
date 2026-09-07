import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { NumberStatList } from "@/components/number-stat-list";
import { NumbersFilter } from "@/components/numbers-filter";
import { SectionTabs } from "@/components/section-tabs";
import { dateShort } from "@/lib/format";
import { NUMBERS_TABS, parseWith, withCompetitionRank } from "@/lib/lotto";
import { getNumberFrequency } from "@/lib/queries";

// 같이 나온 번호(궁합) — 고른 번호(with=1,18)를 모두 포함한 회차 안에서 나머지 번호의 출현 횟수를 센다.
// 기간 필터는 두지 않고 전 기간 고정이다 — 조합의 동반 출현은 표본이 작아(3개 조합 최다 8회) 기간을 자르면 0만
// 남는다. 함께 나온 적 없는(0회) 번호도 목록에서 뺀다(2026-09-07 사용자 결정). 집계 대상(본번호/보너스)만 고른다.
// 검색 파라미터를 읽어 요청마다 렌더하고 조회 결과는 numbers 태그 데이터 캐시에 7일 보관(자주 나오는 번호와 동일).

type Params = { with?: string; bonus?: string };

// 단일 번호 변형(?with=7)은 시도별 명당 순위처럼 자기 canonical + 번호 제목으로 색인한다("7번과 같이 나온 번호",
// 사이트맵 45개). 2개 이상 조합은 경우의 수가 커서 루트를 canonical 로 둔다. 기간·집계 대상은 보기 차이라 제외.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const picked = parseWith((await searchParams).with);
  if (picked.length === 1) {
    return pageMeta({
      core: `${picked[0]}번과 같이 나온 번호`,
      description: `${picked[0]}번과 궁합 좋은 번호를 찾아보세요`,
      path: `/numbers/together?with=${picked[0]}`,
    });
  }
  return pageMeta({
    core: "로또 같이 나온 번호",
    description: "궁합 좋은 번호 조합을 찾아보세요",
    path: "/numbers/together",
  });
}

export default async function TogetherNumbersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const picked = parseWith(params.with);
  const bonus = params.bonus === "1";

  const rows = picked.length ? await getNumberFrequency({ bonus, with: picked }) : [];
  // 고른 번호 자신의 행 값 = 고른 번호가 모두 함께 나온 회차 수(number_frequency 주석 참조).
  // 짝 목록은 고른 번호를 빼고 함께 나온 적 있는(cnt > 0) 번호만 — 회차 수가 0이면 자연히 빈 목록.
  const base = rows.find((r) => r.num === picked[0]);
  const together = base?.cnt ?? 0;
  const partners = rows.filter((r) => !picked.includes(r.num) && r.cnt > 0);
  const maxCnt = partners[0]?.cnt || 1;
  const togetherLabel = picked.length > 1 ? "같이 나온 회차" : "나온 회차";

  const query = bonus ? { bonus: "1" } : {};

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">로또 같이 나온 번호</h1>

      <SectionTabs tabs={NUMBERS_TABS} current="/numbers/together" />

      <NumbersFilter basePath="/numbers/together" bonus={bonus ? "1" : "0"} keep={{ with: picked.join(",") || undefined }} />

      <NumberStatList
        mode="url"
        grid
        basePath="/numbers/together"
        query={query}
        picked={picked}
        hint={
          picked.length === 0
            ? "고른 번호가 없습니다. 번호를 고르면 그 번호와 같이 나온 번호를 보여줍니다."
            : together === 0
              ? `${togetherLabel}가 없습니다.`
              : "같이 나온 다른 번호가 없습니다."
        }
        header={
          base && (
            <div>
              <h2 className="font-bold">{picked.join("·")}번과 같이 나온 번호</h2>
              {together > 0 && (
                <p className="mt-1 text-sm text-stone-500">
                  {togetherLabel}{" "}
                  <b className="text-stone-700">{together.toLocaleString("ko-KR")}회</b>
                  {base.last_date && ` · 최근 ${dateShort(base.last_date)}`}
                </p>
              )}
            </div>
          )
        }
        items={withCompetitionRank(partners, (r) => r.cnt).map((r) => ({
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
