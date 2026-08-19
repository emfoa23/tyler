"use client";

import { useCallback, useEffect, useState } from "react";
import { BallRow } from "@/components/ball";
import { dateShort } from "@/lib/format";
import { RANK_LABEL, matchedNumbers } from "@/lib/lotto";
import type { DrawNumbers, GeneratedSet, GenerationStats } from "@/lib/types";

type ApiData = {
  sets: GeneratedSet[];
  draws: Record<number, DrawNumbers>;
  total: number | null;
  stats: GenerationStats | null;
  nextTarget: number | null;
  nextTargetDate: string | null;
};

type Meta = Pick<ApiData, "stats" | "nextTarget" | "nextTargetDate">;

function getClientId(): string {
  const KEY = "tyler_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-stone-100 ${className}`} />;
}

function HistorySkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4">
          <Pulse className="h-4 w-28" />
          <div className="mt-3 space-y-2">
            <Pulse className="h-7 w-64 max-w-full" />
            <Pulse className="h-7 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </>
  );
}

function ResultBadge({ set, draw }: { set: GeneratedSet; draw?: DrawNumbers }) {
  if (!set.checked_at || !draw) {
    return (
      <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">
        추첨 전
      </span>
    );
  }
  const rank = set.matched_rank ?? 0;
  if (rank === 0) {
    return <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">낙첨</span>;
  }
  return (
    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">
      {RANK_LABEL[rank]} 🎉
    </span>
  );
}

export function GenerateClient() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sets, setSets] = useState<GeneratedSet[]>([]);
  const [draws, setDraws] = useState<Record<number, DrawNumbers>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fresh, setFresh] = useState<GeneratedSet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    const res = await fetch(`/api/generate?clientId=${cid}`, { cache: "no-store" });
    if (!res.ok) throw new Error("load failed");
    const body: ApiData = await res.json();
    setSets(body.sets);
    setDraws(body.draws);
    setTotal(body.total ?? body.sets.length);
    setMeta({ stats: body.stats, nextTarget: body.nextTarget, nextTargetDate: body.nextTargetDate });
  }, []);

  useEffect(() => {
    const cid = getClientId();
    setClientId(cid);
    load(cid)
      .catch(() => setError("기록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [load]);

  async function generate(count: number) {
    if (!clientId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, count }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "생성에 실패했습니다.");
        return;
      }
      setFresh(body.sets);
      // 전체 재로드 — 새 세트가 맨 위로 오고 페이징은 첫 페이지로 리셋된다
      await load(clientId);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!clientId || loadingMore || !sets.length) return;
    setLoadingMore(true);
    try {
      const beforeId = sets[sets.length - 1].id;
      const res = await fetch(`/api/generate?clientId=${clientId}&beforeId=${beforeId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("load failed");
      const body: ApiData = await res.json();
      setSets((prev) => [...prev, ...body.sets]);
      setDraws((prev) => ({ ...prev, ...body.draws }));
    } catch {
      setError("기록을 더 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }

  const grouped = new Map<number, GeneratedSet[]>();
  for (const s of sets) {
    grouped.set(s.target_draw, [...(grouped.get(s.target_draw) ?? []), s]);
  }
  const groups = [...grouped.entries()].sort((a, b) => b[0] - a[0]);
  const stats = meta?.stats;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <h1 className="text-xl font-bold">행운의 번호 뽑기</h1>
        {loading ? (
          <Pulse className="mx-auto mt-2 h-4 w-64 max-w-full" />
        ) : (
          meta?.nextTarget && (
            <p className="mt-1 text-sm text-stone-500">
              지금 생성하면 <b>제{meta.nextTarget}회</b>
              {meta.nextTargetDate && ` (${dateShort(meta.nextTargetDate)} 추첨)`} 대상으로 기록됩니다
            </p>
          )
        )}
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => generate(1)}
            disabled={busy || !clientId}
            className="rounded-xl bg-amber-400 px-6 py-3 text-base font-extrabold text-stone-900 transition hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? "뽑는 중…" : "1세트 뽑기"}
          </button>
          <button
            onClick={() => generate(5)}
            disabled={busy || !clientId}
            className="rounded-xl border border-stone-300 bg-white px-6 py-3 text-base font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            5세트
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        {fresh.length > 0 && (
          <div className="mt-5 space-y-2">
            {fresh.map((s) => (
              <div key={s.id} className="flex justify-center">
                <BallRow numbers={s.numbers} size="lg" />
              </div>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <Pulse className="h-4 w-32" />
          <Pulse className="mt-3 h-4 w-60 max-w-full" />
          <Pulse className="mt-2 h-4 w-72 max-w-full" />
        </section>
      ) : (
        stats && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
            <h2 className="font-bold">이 사이트의 생성 통계</h2>
            <p className="mt-2 text-stone-600">
              지금까지 <b>{stats.total.toLocaleString("ko-KR")}</b>세트 생성 · 추첨 확인{" "}
              <b>{stats.checked.toLocaleString("ko-KR")}</b>세트
            </p>
            <p className="mt-1 text-stone-600">
              실제 당첨 — 1등 <b>{stats.r1}</b> · 2등 <b>{stats.r2}</b> · 3등 <b>{stats.r3}</b> · 4등{" "}
              <b>{stats.r4}</b> · 5등 <b>{stats.r5}</b>
            </p>
            <p className="mt-2 text-xs text-stone-400">
              &lsquo;이 사이트에서 생성된 번호&rsquo; 기준 통계이며, 실제 구매 여부와는 무관합니다.
            </p>
          </section>
        )
      )}

      <section className="space-y-3">
        <h2 className="font-bold">
          내 생성 기록
          {total > 0 && (
            <span className="ml-1.5 text-sm font-normal text-stone-400">
              총 {total.toLocaleString("ko-KR")}세트
            </span>
          )}
        </h2>
        <p className="text-xs text-stone-400">이 기기(브라우저) 기준으로 저장됩니다.</p>
        {loading ? (
          <HistorySkeleton />
        ) : (
          <>
            {groups.length === 0 && (
              <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
                아직 생성한 번호가 없습니다.
              </p>
            )}
            {groups.map(([target, sets]) => {
              const draw = draws[target];
              return (
                <div key={target} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">제{target}회 대상</h3>
                    {draw && (
                      <span className="text-xs text-stone-400">
                        당첨번호 {dateShort(draw.draw_date)}
                      </span>
                    )}
                  </div>
                  {draw && (
                    <div className="mt-2">
                      <BallRow numbers={[draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]} bonus={draw.bonus} size="sm" />
                    </div>
                  )}
                  <ul className="mt-2 divide-y divide-stone-100">
                    {sets.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                        <BallRow
                          numbers={s.numbers}
                          size="sm"
                          matched={s.checked_at && draw ? matchedNumbers(s.numbers, draw) : undefined}
                        />
                        <ResultBadge set={s} draw={draw} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {sets.length < total && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {loadingMore
                  ? "불러오는 중…"
                  : `더 보기 (${(total - sets.length).toLocaleString("ko-KR")}세트 남음)`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
