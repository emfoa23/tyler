// 한 실행에서 "바뀐 URL 집합" — 무효화(/api/ops/revalidate)와 IndexNow 가 같은 목록을 쓴다(2026-09-06).
//   paths: 페이지 캐시를 지울 경로(홈·회차 상세·지점 상세·사이트맵·RSS). 검색 파라미터 화면은 페이지 캐시가
//          없어 경로 대신 tags 로 데이터 캐시를 지운다.
//   tags : draws(최신 회차·목록) · ranking(명당 순위) · numbers(번호 통계) — lib/cache-policy 와 동일.
//   urls : IndexNow 로 알릴 경로(색인 대상만: 핵심 6 + 시도 17 + 번호별 같이 나온 번호 45 + 회차 + 지점).
//          /stores/search 는 내용이 주마다 바뀌지 않아(검색 폼) 사이트맵에만 있고 주간 알림 대상이 아니다.
import { SIDO } from "./dhlottery.mjs";

export const CORE_INDEX_PATHS = ["/", "/history", "/stores", "/numbers", "/numbers/missing", "/numbers/together"];
// 사이트맵 인덱스·하위 파일·RSS — 회차/지점이 바뀌면 변경일이 바뀌므로 함께 지운다(app/sitemap.xml, app/sitemaps/[name], app/rss.xml).
// stores-N 은 lib/sitemap MAX_STORE_SITEMAPS(4)까지 — 없는 파일 경로를 지우는 건 무해하다.
export const FEED_PATHS = [
  "/sitemap.xml", "/rss.xml", "/sitemaps/core.xml", "/sitemaps/history.xml",
  "/sitemaps/stores-1.xml", "/sitemaps/stores-2.xml", "/sitemaps/stores-3.xml", "/sitemaps/stores-4.xml",
];
export const sidoPaths = () => SIDO.map((s) => `/stores?sido=${encodeURIComponent(s)}`);
export const withPaths = () => Array.from({ length: 45 }, (_, i) => `/numbers/together?with=${i + 1}`);
export const roundPath = (n) => `/history/${n}`;
export const storePath = (id) => `/stores/${id}`;

export function newChangeSet() {
  return { paths: new Set(), tags: new Set(), urls: new Set() };
}

/** 회차 이벤트 공통: 홈·피드 페이지 캐시 + 핵심·시도 URL 알림. tags 는 호출자가 고른다. */
export function addCore(cs, tags = []) {
  cs.paths.add("/");
  for (const p of FEED_PATHS) cs.paths.add(p);
  for (const p of [...CORE_INDEX_PATHS, ...sidoPaths(), ...withPaths()]) cs.urls.add(p);
  for (const t of tags) cs.tags.add(t);
}

export function addRound(cs, drawNo) {
  cs.paths.add(roundPath(drawNo));
  cs.urls.add(roundPath(drawNo));
}

export function addStores(cs, storeIds) {
  for (const id of storeIds) {
    cs.paths.add(storePath(id));
    cs.urls.add(storePath(id));
  }
}

export const isEmpty = (cs) => cs.paths.size === 0 && cs.tags.size === 0 && cs.urls.size === 0;

export const summary = (cs) => `${cs.paths.size} paths, ${cs.tags.size} tags, ${cs.urls.size} urls`;
