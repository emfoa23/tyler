import Link from "next/link";
import { KIND_KO, landingLabel, srcLabel, type EventKind } from "@/lib/admin-labels";
import type { RawEvent } from "@/lib/admin-events";
import { eventsHref } from "@/lib/admin-events-url";

// 원본 이벤트 뷰어 UI — 표 대신 행 카드(UA·레퍼러가 길어 375px 에서 가로 스크롤 없이 접히게).
// 1줄: 시각·종류(·회차). 2줄: 판정 결과를 칩으로(랜딩·소스) — 종류 옆에 이어 쓰면 좁은 화면에서 어색하게 꺾여서 분리.
// 카드·pill 스타일은 운영 통계(admin-period-tabs·admin-sections Card)와 동일 토큰(stone) 재사용.

function fmtKst(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const kst = new Date(d.getTime() + 9 * 3600_000);
  return `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())}`;
}

/** 판정 칩 — 흐린 라벨 + 값. 2줄에 나열되며 좁으면 줄바꿈. */
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
      <span className="shrink-0 text-stone-400">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </span>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="w-12 shrink-0 text-stone-400">{label}</span>
      <span className={`min-w-0 break-all ${mono ? "font-mono" : ""}`}>{children}</span>
    </div>
  );
}

function srcOf(kind: string | null, value: string | null): string {
  if (!kind) return "—";
  return srcLabel(value ? `${kind} · ${value}` : kind);
}

/** 행 카드. 기기 ID(앞 8자)는 그 기기만 보는 링크 — 종류 필터는 풀어 전체 행동을 본다. 레퍼러는 링크가 아닌 텍스트. */
export function EventList({ rows, current }: { rows: RawEvent[]; current: { kind: EventKind | null; clientId: string | null } }) {
  if (rows.length === 0) {
    return <p className="text-sm text-stone-400">조건에 맞는 이벤트가 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((e) => {
        const isShare = e.kind === "share" || e.kind === "share_download";
        return (
          <li key={e.id} className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="tabular-nums text-stone-500">{fmtKst(e.created_at)}</span>
              <span className="rounded-md bg-stone-900 px-1.5 py-0.5 text-xs font-semibold text-white">
                {KIND_KO[e.kind] ?? e.kind}
              </span>
              {isShare && e.draw_no !== null && <span className="text-stone-700">{e.draw_no}회</span>}
            </div>
            {e.kind === "visit" && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Chip label="랜딩" value={landingLabel(e.landing)} />
                <Chip label="소스" value={srcOf(e.src_kind, e.src_value)} />
                <Chip label="최초유입" value={srcOf(e.ft_kind, e.ft_value)} />
              </div>
            )}
            <div className="mt-2 space-y-1">
              <Field label="기기" mono>
                {current.clientId === e.client_id ? (
                  <span className="text-stone-700" title={e.client_id}>
                    {e.client_id.slice(0, 8)}
                  </span>
                ) : (
                  <Link
                    href={eventsHref({ kind: null, clientId: e.client_id, page: 1 })}
                    title={`${e.client_id} — 이 기기만 보기`}
                    className="text-stone-700 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-700"
                  >
                    {e.client_id.slice(0, 8)}
                  </Link>
                )}
              </Field>
              <Field label="UA" mono>
                <span className={e.ua ? "text-stone-700" : "text-stone-300"}>{e.ua ?? "—"}</span>
              </Field>
              {e.kind === "visit" && (
                <Field label="레퍼러" mono>
                  <span className={e.referrer_url ? "text-stone-700" : "text-stone-300"}>{e.referrer_url ?? "—"}</span>
                </Field>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 이전·다음 + "n / 전체" — pill 은 줄바꿈·수축하지 않고, SE 에선 두 버튼과 표기가 한 줄에 든다. */
export function EventPager({
  query,
  totalPages,
}: {
  query: { kind: EventKind | null; clientId: string | null; page: number };
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const cell = "shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm";
  const on = "border-stone-200 text-stone-700 hover:bg-stone-100";
  const off = "pointer-events-none border-stone-100 text-stone-300";
  const prev = query.page > 1;
  const next = query.page < totalPages;
  return (
    <nav className="flex items-center justify-center gap-2" aria-label="페이지 이동">
      {prev ? (
        <Link href={eventsHref({ ...query, page: query.page - 1 })} className={`${cell} ${on}`}>
          ‹ 이전
        </Link>
      ) : (
        <span className={`${cell} ${off}`}>‹ 이전</span>
      )}
      <span className="shrink-0 whitespace-nowrap px-1 text-sm tabular-nums text-stone-500">
        {query.page} / {totalPages}
      </span>
      {next ? (
        <Link href={eventsHref({ ...query, page: query.page + 1 })} className={`${cell} ${on}`}>
          다음 ›
        </Link>
      ) : (
        <span className={`${cell} ${off}`}>다음 ›</span>
      )}
    </nav>
  );
}
