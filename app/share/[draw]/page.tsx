import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BallRow } from "@/components/ball";
import { dateShort } from "@/lib/format";
import { drawNumbers } from "@/lib/lotto";
import { getDraw } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";

export const revalidate = 3600;

// 자랑하기 공유 링크 착지 페이지 — 수신자에게 회차 결과 미리보기 + 두 선택지(사용자 확정 설계).
// noindex(thin 랜딩 — 회차 정보의 canonical 은 /history/{draw}). 랜딩 경로 자체가 viral 유입 판정.

function parseDraw(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ draw: string }>;
}): Promise<Metadata> {
  const { draw } = await params;
  const drawNo = parseDraw(draw);
  if (!drawNo) return {};
  return pageMeta({
    core: `${drawNo}회 당첨 인증`,
    description: "당첨 결과를 확인하고 내 번호도 만들어보세요",
    path: `/share/${drawNo}`,
    noindex: true,
  });
}

export default async function SharePage({ params }: { params: Promise<{ draw: string }> }) {
  const { draw: rawDraw } = await params;
  const drawNo = parseDraw(rawDraw);
  if (!drawNo) notFound();
  const draw = await getDraw(drawNo);
  if (!draw) notFound(); // 미추첨(미래)·없는 회차

  return (
    <div className="mx-auto max-w-md space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-amber-600">● lottogen</p>
        <h1 className="mt-1 text-xl font-bold">{drawNo}회 당첨 인증</h1>
        <p className="mt-1 text-sm text-stone-500">
          {dateShort(draw.draw_date)} 추첨 당첨번호
        </p>
        <div className="mt-4 flex justify-center">
          <BallRow numbers={drawNumbers(draw)} bonus={draw.bonus} size="lg" />
        </div>
      </section>

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
    </div>
  );
}
