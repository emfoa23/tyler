import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { ADMIN_COOKIE, checkAdminCookie } from "@/lib/admin-auth";
import { getRawEvents, parsePageParam } from "@/lib/admin-events";
import { isEventKind } from "@/lib/admin-labels";
import { AdminLogin } from "@/components/admin-login";
import { AdminUiMarker } from "@/components/admin-ui-marker";
import { EventKindFilter, EventList, EventPager, eventsHref } from "@/components/admin-event-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  core: "원본 이벤트",
  description: "로또젠 방문·이용 원본 이벤트를 확인하세요",
  path: "/admin/events",
  noindex: true,
});

/**
 * 원본 이벤트(운영자 전용) — analytics_events raw 를 종류 필터·페이지로 그대로 본다.
 * 집계(운영 통계)가 답하지 못하는 "직접 유입이 어디서 오나" 를 UA·레퍼러 원문으로 사람이 읽는 화면.
 * 파싱·분류는 하지 않는다(통제할 수 없는 값이라 미리 쪼갤 기준이 없다).
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const cookieStore = await cookies();
  if (!checkAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return <AdminLogin />;
  }

  const sp = await searchParams;
  const kind = isEventKind(sp.kind) ? sp.kind : null;
  const page = parsePageParam(sp.page);
  const { rows, total, pageSize } = await getRawEvents({ kind, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (rows.length === 0 && page > 1) redirect(eventsHref(kind, 1));

  return (
    <div className="space-y-4">
      <AdminUiMarker />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-xl font-bold">원본 이벤트</h1>
        <Link href="/admin" className="whitespace-nowrap text-sm font-medium text-stone-500 hover:text-stone-900">
          ← 운영 통계
        </Link>
      </div>
      <p className="text-xs leading-relaxed text-stone-400">
        방문·이용 원본(최근 90일, 최신순). UA·레퍼러는 저장된 원문 그대로예요 — 어떤 앱·브라우저에서
        왔는지는 여기서 직접 읽고, 분류는 나중에 정해요.
      </p>
      <EventKindFilter current={kind} />
      <p className="text-xs text-stone-500">
        총 {total.toLocaleString()}건{kind && " (필터 적용)"} · {pageSize}건씩
      </p>
      <EventList rows={rows} />
      <EventPager kind={kind} page={page} totalPages={totalPages} />
    </div>
  );
}
