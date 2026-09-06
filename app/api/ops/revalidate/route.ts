import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/ops";
import { CACHE_TAGS } from "@/lib/cache-policy";

export const dynamic = "force-dynamic";

// 동기화 스크립트(sync-draw·sync-stores)가 "이번 실행에서 바뀐 것"만 골라 지운다 — 2026-09-06 정밀 무효화.
// 예전엔 모든 회차·모든 지점 페이지를 통째로 지워 봇이 도는 만큼 2만 페이지가 매주 재생성됐다.
// body: { paths?: string[], tags?: string[] } — paths 는 페이지 캐시(홈·회차·지점·사이트맵·RSS),
// tags 는 데이터 캐시(회차 목록·명당 순위·번호 통계 — 검색 파라미터를 읽어 페이지 캐시가 없는 화면들).
// 시크릿이 있어도 임의 경로를 못 지우게 모양을 허용 목록으로 제한한다.
const PATH_RE = /^(\/|\/history\/\d{1,5}|\/stores\/[A-Za-z0-9]{1,20}|\/sitemap\.xml|\/sitemaps\/[a-z0-9-]{1,40}\.xml|\/rss\.xml)$/;
const MAX_ITEMS = 5000;
const TAG_SET = new Set<string>(Object.values(CACHE_TAGS));

export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { paths?: unknown; tags?: unknown };
  const paths = (Array.isArray(body.paths) ? body.paths : [])
    .filter((p): p is string => typeof p === "string" && PATH_RE.test(p))
    .slice(0, MAX_ITEMS);
  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .filter((t): t is string => typeof t === "string" && TAG_SET.has(t))
    .slice(0, MAX_ITEMS);
  for (const p of paths) revalidatePath(p);
  // { expire: 0 } = 즉시 만료(다음 요청이 새로 만든다). "max" 는 한 번 더 옛 값을 내주는 SWR 이라 쓰지 않는다.
  for (const t of tags) revalidateTag(t, { expire: 0 });
  return NextResponse.json({ ok: true, paths: paths.length, tags: tags.length, at: new Date().toISOString() });
}
