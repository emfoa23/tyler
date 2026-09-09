import Link from "next/link";
import {
  EVENT_KINDS,
  KIND_KO,
  landingLabel,
  srcLabel,
  type EventKind,
} from "@/lib/admin-labels";
import type { RawEvent } from "@/lib/admin-events";

// 원본 이벤트 뷰어 UI — 표 대신 행 카드(UA·레퍼러가 길어 375px 에서 가로 스크롤 없이 접히게).
// pill·카드 스타일은 운영 통계(admin-period-tabs·admin-sections Card)와 동일 토큰(stone) 재사용.

export function eventsHref(kind: EventKind | null, page: number): string {
  const u = new URLSearchParams();
  if (kind) u.set("kind", kind);
  if (page > 1) u.set("page", String(page));
  const qs = u.toString();
  return `/admin/events${qs ? `?${qs}` : ""}`;
}

const PILL = "whitespace-nowrap rounded-lg px-2.5 py-1.5";
const PILL_ON = "bg-stone-900 text-white";
const PILL_OFF = "text-stone-500 hover:bg-stone-100 hover:text-stone-900";

/** 이벤트 종류 필터 — 기간 탭과 같은 pill, 좁은 화면에선 줄바꿈. 변경 시 1페이지로. */
export function EventKindFilter({ current }: { current: EventKind | null }) {
  return (
    <div className="flex flex-wrap gap-1 text-sm font-medium">
      <Link href={eventsHref(null, 1)} className={`${PILL} ${current === null ? PILL_ON : PILL_OFF}`}>
        전체
      </Link>
      {EVENT_KINDS.map((k) => (
        <Link key={k} href={eventsHref(k, 1)} className={`${PILL} ${current === k ? PILL_ON : PILL_OFF}`}>
          {KIND_KO[k]}
        </Link>
      ))}
    </div>
  );
}

function fmtKst(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const kst = new Date(d.getTime() + 9 * 3600_000);
  return `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())}`;
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="w-12 shrink-0 text-stone-400">{label}</span>
      <span className={`min-w-0 break-all ${mono ? "font-mono" : ""} ${value ? "text-stone-700" : "text-stone-300"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/** 행 카드 — 첫 줄: 시각·종류·랜딩·소스, 아래: 최초유입·기기·UA·레퍼러 원문. 레퍼러는 링크가 아닌 텍스트. */
export function EventList({ rows }: { rows: RawEvent[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-stone-400">조건에 맞는 이벤트가 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((e) => {
        const src = e.src_kind ? srcLabel(e.src_value ? `${e.src_kind} · ${e.src_value}` : e.src_kind) : null;
        const ft = e.ft_kind ? srcLabel(e.ft_value ? `${e.ft_kind} · ${e.ft_value}` : e.ft_kind) : null;
        return (
          <li key={e.id} className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="tabular-nums text-stone-500">{fmtKst(e.created_at)}</span>
              <span className="rounded-md bg-stone-900 px-1.5 py-0.5 text-xs font-semibold text-white">
                {KIND_KO[e.kind] ?? e.kind}
              </span>
              {e.kind === "visit" && (
                <>
                  <span className="text-stone-700">{landingLabel(e.landing)}</span>
                  <span className="text-stone-400">·</span>
                  <span className="text-stone-700">{src ?? "—"}</span>
                </>
              )}
              {(e.kind === "share" || e.kind === "share_download") && e.draw_no !== null && (
                <span className="text-stone-700">{e.draw_no}회</span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {e.kind === "visit" && <Field label="최초유입" value={ft} />}
              <Field label="기기" value={e.client_id.slice(0, 8)} mono />
              <Field label="UA" value={e.ua} mono />
              {e.kind === "visit" && <Field label="레퍼러" value={e.referrer_url} mono />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 이전·다음 + "n / 전체" — pill 은 줄바꿈·수축하지 않고, SE 에선 두 버튼과 표기가 한 줄에 든다. */
export function EventPager({
  kind,
  page,
  totalPages,
}: {
  kind: EventKind | null;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const cell = "shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm";
  const on = "border-stone-200 text-stone-700 hover:bg-stone-100";
  const off = "pointer-events-none border-stone-100 text-stone-300";
  const prev = page > 1;
  const next = page < totalPages;
  return (
    <nav className="flex items-center justify-center gap-2" aria-label="페이지 이동">
      {prev ? (
        <Link href={eventsHref(kind, page - 1)} className={`${cell} ${on}`}>
          ‹ 이전
        </Link>
      ) : (
        <span className={`${cell} ${off}`}>‹ 이전</span>
      )}
      <span className="shrink-0 whitespace-nowrap px-1 text-sm tabular-nums text-stone-500">
        {page} / {totalPages}
      </span>
      {next ? (
        <Link href={eventsHref(kind, page + 1)} className={`${cell} ${on}`}>
          다음 ›
        </Link>
      ) : (
        <span className={`${cell} ${off}`}>다음 ›</span>
      )}
    </nav>
  );
}
