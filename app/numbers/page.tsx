import type { Metadata } from "next";
import { Ball } from "@/components/ball";
import { NumbersFilter } from "@/components/numbers-filter";
import { PagedList } from "@/components/paged-list";
import { dateShort } from "@/lib/format";
import { getNumberFrequency } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "로또 자주 나오는 번호 — 1~45 출현 빈도 통계",
  description:
    "로또 6/45에서 가장 자주 나오는 번호 순위. 1회차부터 현재까지 번호별 출현 횟수와 최근 출현 회차를 전체 기간·최근 6개월·1년·5년, 보너스 번호 포함 여부로 골라 볼 수 있습니다.",
  alternates: { canonical: "/numbers" },
  openGraph: {
    title: "로또 자주 나오는 번호 | lottogen",
    description: "1~45 번호별 출현 횟수 순위 — 기간·보너스 번호 포함 필터",
    url: "/numbers",
  },
};

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

      <NumbersFilter months={months ? String(months) : "all"} bonus={bonus ? "1" : "0"} />

      <PagedList
        pageSize={10}
        className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4"
        items={rows.map((r, i) => (
          <li key={r.num} className="flex items-center gap-3 py-2.5">
            <span className="w-6 shrink-0 text-center text-sm font-bold text-stone-400">
              {i + 1}
            </span>
            <Ball n={r.num} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block h-2 rounded-full bg-stone-100">
                <span
                  className="block h-2 rounded-full bg-amber-400"
                  style={{ width: `${(r.cnt / maxCnt) * 100}%` }}
                />
              </span>
            </span>
            <span className="w-24 shrink-0 text-right">
              <span className="block text-sm font-semibold">{r.cnt.toLocaleString("ko-KR")}회</span>
              <span className="block text-xs text-stone-400">
                {r.last_draw ? `최근 ${dateShort(r.last_date!)}` : "출현 없음"}
              </span>
            </span>
          </li>
        ))}
      />

      <p className="text-xs leading-relaxed text-stone-400">
        출현 빈도는 과거 기록일 뿐이며, 매 회차는 독립 추첨이라 미래의 당첨 확률과는 무관합니다.
      </p>
    </div>
  );
}
