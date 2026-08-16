import Link from "next/link";
import { BallRow } from "@/components/ball";
import { StoreBadges } from "@/components/store-badge";
import { dateK, dateShort, wonShort } from "@/lib/format";
import { drawNumbers, storeDisplayName } from "@/lib/lotto";
import { getDraws, getLatestDraw, getRanking } from "@/lib/queries";

export const revalidate = 3600;

export default async function HomePage() {
  const latest = await getLatestDraw();

  if (!latest) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-500">
        첫 데이터 동기화가 진행 중입니다. 잠시 후 다시 열어주세요.
      </div>
    );
  }

  const [top, { rows: recentRows }] = await Promise.all([
    getRanking({ limit: 5 }),
    getDraws(1),
  ]);
  const recent = recentRows.filter((d) => d.draw_no !== latest.draw_no).slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="text-xl font-bold">
            제{latest.draw_no}회 당첨번호
          </h1>
          <span className="text-sm text-stone-500">{dateK(latest.draw_date)} 추첨</span>
        </div>
        <div className="mt-4">
          <BallRow numbers={drawNumbers(latest)} bonus={latest.bonus} size="lg" />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-stone-50 p-3">
            <dt className="text-stone-500">1등</dt>
            <dd className="mt-0.5 font-semibold">
              {latest.r1_winners ?? "-"}명 · 각 {wonShort(latest.r1_prize_each)}
            </dd>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <dt className="text-stone-500">2등</dt>
            <dd className="mt-0.5 font-semibold">
              {latest.r2_winners ?? "-"}명 · 각 {wonShort(latest.r2_prize_each)}
            </dd>
          </div>
        </dl>
        <Link
          href={`/history/${latest.draw_no}`}
          className="mt-4 inline-block text-sm font-medium text-amber-600 hover:underline"
        >
          이 회차 상세·배출점 보기 →
        </Link>
      </section>

      <Link
        href="/generate"
        className="block rounded-2xl bg-amber-400 py-5 text-center text-lg font-extrabold text-stone-900 shadow-sm transition hover:bg-amber-300"
      >
        🎲 행운의 번호 뽑기
      </Link>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">명당 TOP 5</h2>
          <Link href="/stores" className="text-sm text-stone-500 hover:underline">
            전체 랭킹 →
          </Link>
        </div>
        <ol className="mt-3 divide-y divide-stone-100">
          {top.map((s, i) => (
            <li key={s.store_id}>
              <Link
                href={`/stores/${s.store_id}`}
                className="flex items-center gap-3 py-2.5 hover:bg-stone-50"
              >
                <span className="w-5 text-center font-bold text-stone-400">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{storeDisplayName(s)}</span>
                    <StoreBadges storeId={s.store_id} status={s.status} />
                  </span>
                  <span className="truncate text-xs text-stone-500">
                    {[s.sido, s.sigungu].filter(Boolean).join(" ")}
                  </span>
                </span>
                <span className="text-sm text-stone-600">
                  1등 <b>{s.r1}</b> · 2등 <b>{s.r2}</b>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-stone-400">
          1·2등 배출 이력 누적 기준 (배출점 데이터가 제공되는 262회차 이후).
        </p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">지난 회차</h2>
          <Link href="/history" className="text-sm text-stone-500 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-stone-100">
          {recent.map((d) => (
            <li key={d.draw_no}>
              <Link href={`/history/${d.draw_no}`} className="block py-2.5 hover:bg-stone-50">
                <span className="flex items-baseline gap-3">
                  <span className="text-sm font-semibold">제{d.draw_no}회</span>
                  <span className="text-xs text-stone-500">{dateShort(d.draw_date)}</span>
                </span>
                <span className="mt-1.5 block">
                  <BallRow numbers={drawNumbers(d)} bonus={d.bonus} size="sm" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
