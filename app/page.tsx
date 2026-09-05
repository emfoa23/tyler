import type { Metadata } from "next";
import Link from "next/link";
import { Ball, BallRow } from "@/components/ball";
import { StoreBadges } from "@/components/store-badge";
import { dateK, dateShort, wonShort } from "@/lib/format";
import { HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";
import { drawNumbers, isOnlineStore, rankByMissed, storeDisplayName } from "@/lib/lotto";
import { isPrizePublished } from "@/lib/draw-state.mjs";
import { getDraws, getLatestDraw, getNumberFrequency, getRanking } from "@/lib/queries";

export const revalidate = 3600;

// 레이아웃의 상대 canonical("./") 이 홈에서만 "/index" 로 풀리는 Next 동작이 있어 명시로 고정
export const metadata: Metadata = pageMeta({ absoluteTitle: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" });

export default async function HomePage() {
  const latest = await getLatestDraw();

  if (!latest) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-500">
        첫 데이터 동기화가 진행 중입니다. 잠시 후 다시 열어주세요.
      </div>
    );
  }

  // 명당은 역대 전체(최근 1년은 수가 적어 비어 보임 — 2026-08-20 결정).
  // 번호 TOP 5 두 종은 각 목록 페이지의 디폴트 필터(전체 기간·본번호)와 일치시켜
  // '전체 보기' 랜딩에서 홈과 같은 순위가 이어지게 한다 (2026-09-02 결정, 부가 설명 캡션 불필요).
  const [top, freqAll, { rows: recentRows }] = await Promise.all([
    getRanking({ limit: 5 }),
    getNumberFrequency({}),
    getDraws(1),
  ]);
  const freq = freqAll.slice(0, 5);
  const missedTop = rankByMissed(freqAll, latest.draw_no).slice(0, 5);
  const recent = recentRows.filter((d) => d.draw_no !== latest.draw_no).slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        {/* 제목이 길어 375px 에선 날짜를 아래 줄로 — sm 이상은 기존처럼 양끝 한 줄 */}
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
          <h1 className="text-xl font-bold">
            로또 {latest.draw_no}회 당첨번호
          </h1>
          <span className="text-sm text-stone-500">{dateK(latest.draw_date)} 추첨</span>
        </div>
        <div className="mt-4">
          <BallRow numbers={drawNumbers(latest)} bonus={latest.bonus} size="lg" />
        </div>
        {/* 375px 에선 박스 2개를 세로로 쌓고 라벨·값을 한 줄에(값이 줄바꿈되지 않게), sm 이상은 기존 2열 박스 */}
        {/* 당첨금 묶음 공개 전(추첨 직후 ~20:49)엔 1등·2등 상자를 아예 그리지 않는다 — 판정은 lib/draw-state */}
        {isPrizePublished(latest) && (
          <dl className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-3">
            <div className="flex items-baseline gap-2 rounded-lg bg-stone-50 px-3 py-2 sm:block sm:p-3">
              <dt className="text-stone-500">1등</dt>
              <dd className="font-semibold sm:mt-0.5">
                {latest.r1_winners ?? "-"}명 · 각 {wonShort(latest.r1_prize_each)}
              </dd>
            </div>
            <div className="flex items-baseline gap-2 rounded-lg bg-stone-50 px-3 py-2 sm:block sm:p-3">
              <dt className="text-stone-500">2등</dt>
              <dd className="font-semibold sm:mt-0.5">
                {latest.r2_winners ?? "-"}명 · 각 {wonShort(latest.r2_prize_each)}
              </dd>
            </div>
          </dl>
        )}
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
            전체 순위 →
          </Link>
        </div>
        <ol className="mt-3 divide-y divide-stone-100">
          {top.map((s) => (
            <li key={s.store_id}>
              <Link
                href={`/stores/${s.store_id}`}
                className="flex items-center gap-3 py-2.5 hover:bg-stone-50"
              >
                <span className="w-5 text-center font-bold text-stone-400">{s.rnk}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{storeDisplayName(s)}</span>
                    <StoreBadges storeId={s.store_id} status={s.status} />
                  </span>
                  <span className="truncate text-xs text-stone-500">
                    {isOnlineStore(s.store_id)
                      ? "전국 온라인 구매 합산"
                      : [s.sido, s.sigungu].filter(Boolean).join(" ")}
                  </span>
                </span>
                <span className="text-sm text-stone-600">
                  1등 <b>{s.r1}</b> · 2등 <b>{s.r2}</b>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">자주 나오는 번호 TOP 5</h2>
          <Link href="/numbers" className="text-sm text-stone-500 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {freq.map((r) => (
            <span key={r.num} className="flex items-center gap-1.5">
              <Ball n={r.num} size="md" />
              <span className="text-sm text-stone-600">
                <b>{r.cnt}</b>회
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">안나온 번호 TOP 5</h2>
          <Link href="/numbers/missing" className="text-sm text-stone-500 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {missedTop.map((r) => (
            <span key={r.num} className="flex items-center gap-1.5">
              <Ball n={r.num} size="md" />
              <span className="text-sm text-stone-600">
                <b>{r.missed}</b>회째
              </span>
            </span>
          ))}
        </div>
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
                  <span className="text-sm font-semibold">{d.draw_no}회</span>
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
