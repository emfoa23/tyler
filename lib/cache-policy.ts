// 캐시 정책 단일 소스 (2026-09-06).
//
// 데이터는 일주일에 세 번만 바뀐다 — 토요일 sync-draw(회차·그 주 배출점), 일요일 04:30 sync-stores(지점 상호·주소·폐점),
// 일요일 10:00 sync-draw 재대조. 세 이벤트가 바뀐 것만 정확히 지우므로(/api/ops/revalidate) 유효기간은
// "지우기를 빠뜨렸을 때의 안전망"이고 7일이면 매주 자가 치유된다. 기간 필터는 최신 추첨일 기준이라 날짜가 지나도
// 결과가 흔들리지 않는다(store_ranking/number_frequency p_anchor).
//
// 비용 상한: 재생성은 페이지당 7일에 한 번이 최대라 봇이 2만 페이지를 매주 다 돌아도 월 9만 회 안쪽(무료 한도 20만).
//
// 페이지 파일의 `export const revalidate = 604800` 은 Next 가 정적으로 읽어야 해서 리터럴로 적는다 — 이 값과 같아야 한다.
export const CACHE_TTL_SECONDS = 604800;

// 데이터 캐시 태그 — 검색 파라미터를 읽어 페이지 캐시가 꺼지는 화면(회차 목록·명당 순위·번호 통계)의 조회 결과용.
export const CACHE_TAGS = {
  draws: "draws", // 최신 회차·회차 목록 (토요일)
  ranking: "ranking", // 명당 순위 집계 (토요일 배출점, 일요일 지점 변경·재대조)
  numbers: "numbers", // 번호 출현 통계 (토요일)
} as const;
