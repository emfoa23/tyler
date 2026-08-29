import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BallRow } from "@/components/ball";
import { db } from "@/lib/db";
import { dateShort } from "@/lib/format";
import { drawNumbers, matchedNumbers, RANK_LABEL } from "@/lib/lotto";
import { getDraw } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Draw } from "@/lib/types";

export const revalidate = 3600;

// 자랑하기 공유 착지 — 토큰(32hex)이 "그 기기의 해당 회차 당첨 내역" 개인화 페이지를 가리킨다
// (사용자 확정: 회차로 퉁치지 않는다 — 뭐로 어떻게 당첨됐는지가 본문. 회차 일반 착지는 제거).
// client_id 는 URL 에 노출하지 않는다 — 토큰이 (기기, 회차)의 당첨 세트만 간접 참조.
// noindex(thin 랜딩 — 회차 정보의 canonical 은 /history/{draw}). 랜딩 경로 자체가 viral 유입 판정.

const TOKEN_RE = /^[0-9a-f]{32}$/;

type WinningSet = { id: number; numbers: number[]; matched_rank: number };

const getShare = cache(async (token: string) => {
  const { data } = await db
    .from("shares")
    .select("token, client_id, draw_no")
    .eq("token", token)
    .maybeSingle();
  return data ?? null;
});

async function getWinningSets(clientId: string, drawNo: number): Promise<WinningSet[]> {
  const { data } = await db
    .from("generated_sets")
    .select("id, numbers, matched_rank")
    .eq("client_id", clientId)
    .eq("target_draw", drawNo)
    .gte("matched_rank", 1)
    .order("matched_rank", { ascending: true })
    .order("id", { ascending: true });
  return (data ?? []) as WinningSet[];
}

async function resolveDrawNo(slug: string): Promise<number | null> {
  if (TOKEN_RE.test(slug)) return (await getShare(slug))?.draw_no ?? null;
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const drawNo = await resolveDrawNo(slug);
  if (!drawNo) return {};
  return pageMeta({
    core: `${drawNo}회 당첨 인증`,
    description: "당첨 결과를 확인하고 내 번호도 만들어보세요",
    path: `/share/${slug}`,
    noindex: true,
  });
}

function Ctas({ drawNo }: { drawNo: number }) {
  return (
    <>
      <div className="grid gap-2">
        <Link
          href="/generate"
          className="rounded-xl bg-amber-400 px-6 py-3.5 text-center text-base font-extrabold text-stone-900 transition hover:bg-amber-300"
        >
          나도 번호 만들러 가기
        </Link>
        <Link
          href={`/history/${drawNo}`}
          className="rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-center text-base font-bold text-stone-700 transition hover:bg-stone-50"
        >
          {drawNo}회 당첨 결과 보기
        </Link>
      </div>
      <p className="text-center text-xs text-stone-400">
        번호 생성은 완전한 무작위이며 당첨을 보장하지 않습니다.
      </p>
    </>
  );
}

function DrawHeader({ draw, drawNo }: { draw: Draw; drawNo: number }) {
  return (
    <>
      <p className="text-sm font-semibold text-amber-600">● lottogen</p>
      <h1 className="mt-1 text-xl font-bold">{drawNo}회 당첨 인증</h1>
      <p className="mt-1 text-sm text-stone-500">{dateShort(draw.draw_date)} 추첨 당첨번호</p>
      <div className="mt-4 flex justify-center">
        <BallRow numbers={drawNumbers(draw)} bonus={draw.bonus} size="md" />
      </div>
    </>
  );
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 개인화: 토큰 → 그 기기의 당첨 세트
  if (TOKEN_RE.test(slug)) {
    const share = await getShare(slug);
    if (!share) notFound();
    const [draw, wins] = await Promise.all([
      getDraw(share.draw_no),
      getWinningSets(share.client_id, share.draw_no),
    ]);
    if (!draw || wins.length === 0) notFound();
    return (
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <DrawHeader draw={draw} drawNo={share.draw_no} />
          <ul className="mt-5 space-y-2.5 border-t border-stone-100 pt-4">
            {wins.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                <BallRow numbers={s.numbers} size="md" matched={matchedNumbers(s.numbers, draw)} />
                <span className="shrink-0 whitespace-nowrap rounded-md bg-amber-50 px-2 py-0.5 text-sm font-bold text-amber-700">
                  {RANK_LABEL[s.matched_rank] ?? `${s.matched_rank}등`} 🎉
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-400">이 기기에서 lottogen 으로 생성해 당첨된 번호예요.</p>
        </section>
        <Ctas drawNo={share.draw_no} />
      </div>
    );
  }

  notFound();
}
