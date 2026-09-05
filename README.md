# tyler — lottogen.click

로또 6/45 번호 생성 + 회차별 당첨 결과 + 명당(1·2등 배출점) 순위 서비스.

- **번호 생성** — 서버 무작위 생성, 기기별(localStorage 익명 id) 이력 저장
- **당첨 대조** — 생성 시점의 대상 회차(추첨 시각 토 20:35 KST 기준)로 귀속, 추첨 후 자동 대조
- **회차 히스토리** — 1회차(2002)부터 전 회차 당첨번호·등위별 당첨금
- **명당 순위 / 지점별 배출 이력** — 262회차(2007-12)부터의 1·2등 배출점 데이터 기반.
  온라인 채널(동행복권 사이트, `51100000`)도 순위에 포함하되 "온라인" 배지로 구분
- **번호 통계** — 자주 나오는 번호(출현 횟수)·안나온 번호(마지막 출현 뒤 미출현 회차수) 순위

## 스택

| 역할 | 서비스 |
|---|---|
| 웹 (서빙 + 생성 로그) | Next.js App Router → Vercel (함수 리전 `icn1`) |
| 저장소 | Supabase Postgres (RLS deny-all, 서버는 service role 만 사용) |
| 크롤·적재·대조 | GitHub Actions (`workflow_dispatch` 전용) |
| 스케줄러 | cron-job.org → GitHub API dispatch 호출 |

레포 워크플로에 `on: schedule` 이 없는 것은 의도된 구조다. GitHub 은 60일간 커밋이 없으면
스케줄 워크플로를 자동 비활성화하므로(v1 크롤이 죽은 원인), 스케줄은 전부 cron-job.org 가
외부에서 dispatch 한다. 이 구조는 레포가 1년 조용해도 죽지 않는다.

```
cron-job.org (유일한 스케줄러)
  │  POST /repos/emfoa23/tyler/actions/workflows/{yml}/dispatches
  ├─ sync-draw    토 20:40~21:05 5분 간격 + 22:00/23:00 백스톱 + 일 10:00 KST (멱등 재시도)
  │    당첨결과(기대 회차 1회 조회로 신규 적재 + 지연 필드 재보정) → 생성번호 대조
  │    → 배출점(최신 회차 미적재 시 1회, 추첨 후 12시간 지난 실행은 최근 3회차 재대조) → ISR revalidate → IndexNow 핑
  ├─ sync-stores  일요일 새벽 주 1회 — 전국 판매점 마스터 upsert + 미출현 지점 closed 마킹
  └─ keepalive    매일 — GET /api/ops/keepalive (Supabase 무료 pause 방지)
```

## 검색 노출(SEO)

- 페이지 메타는 `lib/seo.ts` `pageMeta()` 단일 진입점 — title(`lottogen` 제외 15자, 단 지점 상세는 "지점명 — 로또 명당"으로 지점명을 자르지 않음)·description(30자 이내 행동 유도문, title 과 내용 중복 없음)·canonical·OG·Twitter 를 한 쌍의 값으로 채우고 og:image 는 전 페이지 공통 1장. 회차 상세 title/description 엔 당첨번호를 넣지 않는다(페이지에 들어와야 보이게, JSON-LD 에만). 명당은 `?sido=` 변형이 지역명 title + 자기 canonical.
- `app/sitemap.ts`: 핵심 페이지 + 17개 `?sido=` 명당 변형 + 전 회차 상세(지점 페이지는 제외 — ISR 폭증 방지). `public/robots.txt` 전체 허용 + sitemap.
- IndexNow(`scripts/lib/indexnow.mjs`, 키 파일 `public/<key>.txt`): sync-draw 가 변경을 반영하면 홈·목록·명당·번호·최신 회차 URL 을 핑(네이버·Bing 등 참여 엔진). Google 은 sitemap + Search Console.
- `public/llms.txt`: 페이지 패턴·데이터·갱신 주기(생성형 검색 인용용).

## 데이터 소스

동행복권 공개 JSON API (2026-08 개편 후, 전부 GET·UTF-8):

- 회차별 당첨결과 `/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={회차}` — 요청 회차부터 아래로 10개.
  추첨 직후엔 당첨자수·당첨금·판매액·1등 구매유형이 null 이 아니라 0 으로 온다(번호 ~20:42 → 당첨금·판매액 ~20:49 → 구매유형·배출점 ~21:00, 2026-09-05 실측). **DB 에는 원본 0 을 그대로 저장**하고 공개 여부는 `lib/draw-state.mjs` 가 묶음 단위로 판정한다 — 당첨금 묶음 = 5등 당첨자 > 0, 판매액 > 0, 구매유형 = 1등이 있는데 세 유형 합이 0 이면 미공개. 화면은 미공개 묶음을 아예 그리지 않고(홈 1·2등 상자, 목록의 1등 줄, 상세의 등위별 표·판매액 줄), sync-draw 는 같은 판정으로 최신 회차를 재조회한다. 개별 0(이월 회차의 1등 0명, 반자동 0 등)은 실제 값이라 그대로 보인다
- 회차별 1·2등 배출점 `/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd={회차}` — 262회차부터, 행=당첨 게임 1건
- 전국 판매점 마스터 `/prchsplcsrch/selectLtShp.do?srchCtpvNm={시도}` — 시도는 짧은 이름("서울"), 페이지당 10건 고정
- **호출 정책·관측**(2026-09-05): 러너 IP 는 짧은 버스트에도 스로틀되므로 sync-draw 는 슬롯당 호출을 1~2회로 유지한다(기대 회차 1회 조회로 신규+지연 필드, 배출점은 최신 회차 미적재 시만). 재시도는 4회·15s 타임아웃·백오프 1/4/9s(콜당 최악 ~75초, `scripts/lib/dhlottery.mjs`). **모든 호출은 성공·실패를 불문하고 `dhlottery ok|fail <endpoint?query> <ms> (try i/n)` 한 줄**을 남기고 스크립트 단계 로그엔 `[+경과초]` 가 붙는다(`scripts/lib/log.mjs`) — Actions 로그만으로 어느 호출이 얼마나 막혔는지 복원할 수 있다. 검증 훅 `SYNC_NOW=<ISO>` 로 기대 회차·12시간 규칙을 임의 시점으로 시험한다.

## 개발

```sh
npm install
npm run dev        # .env.local 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPS_SECRET, ADMIN_SECRET
```

스키마는 `supabase/schema.sql` (Supabase Management API 로 적용).

## 자랑하기·바이럴 루프 (2026-08-29)

당첨만 보기에서 당첨 회차마다 **자랑하기** — 클릭 즉시 캔버스로 자랑 카드를 그려(회차·등수 요약·
당첨번호·맞춘 번호 하이라이트·`lottogen.click` 워터마크, `lib/brag-image.ts`) **Web Share 시트**를
연다(`files` + `text`=링크만 — url 필드는 안드로이드에서 text 와 동일 슬롯이라 중복 방지 차원에서
미사용, 저장/공유 선택은 OS 시트 몫). 사용자 취소(AbortError)는 무집계, 그 외 실패·미지원은
이미지 다운로드+링크 클립보드 폴백. 링크 착지 `/share/{token}`(noindex, title "N회 당첨 인증")은 **그 기기의 해당 회차 당첨 내역**
(당첨번호·맞춘 번호 하이라이트·등수)을 보여준다 — 토큰은 자랑 시점 `POST /api/share` 가 발급
((기기,회차) 당 1행 upsert, client_id 는 URL 비노출·당첨 실존 검증). 회차 일반 착지는 없음. 수집: `share`(공유 시트 완료 — 시트 안 행동은 관측 불가)/`share_download`(미지원 폴백)
이벤트(+`draw_no`, 어드민은 합산 '자랑 실행'으로 표기)·`/share` 랜딩=viral 소스(레퍼러 아닌 경로 판정 — 인앱 레퍼러 소실 무관)·기기
`first_share_day`. 어드민 "바이럴 루프" 섹션이 당첨 확인→자랑 실행→공유 유입 신규 기기→생성 도달을
윈도우별로 보여주고 성적표에 회차별 공유 수를 병기한다(이미지-only 유입은 direct 로 잡히는 한계 각주).

## 운영 통계·어드민 (2026-08-29)

`/admin`(운영자 전용, noindex) — **퍼널·유저 구성·유입·바이럴 루프·생성분석** 5섹션 + [오늘|7일|30일|전체](KST 달력일) 기간 탭.

- **인증**: 가입 기능이 없으므로 `ADMIN_SECRET`(Vercel env) 시크릿 로그인 — 상수시간 비교 후
  sha256 파생 토큰을 HttpOnly 쿠키(30일)로 발급(`lib/admin-auth.ts`, `/api/admin/login`).
- **수집**: 방문(탭 세션당 1회, 랜딩 그룹+current/first-touch 소스)·생성기 진입은 전역 비콘
  (`components/analytics-beacon.tsx` → `POST /api/track`, 기기당 500행/일 캡, **봇 게이트**: ①렌더링 크롤러 UA·navigator.webdriver 클라·서버 양쪽 드롭(UA 무저장) ②**상호작용 게이트** — 첫 터치/스크롤/키 입력 후에만 전송(무신분 렌더러 원천 차단, 방문='상호작용한 방문')), '당첨 확인'은
  `GET /api/generate?wins=1`('당첨만 보기') 첫 페이지 조회 중 **이미 추첨이 끝난 참여 회차가
  있는 기기**만 서버가 적재(위조 방지 — 2026-08-29 재정의, 단순 목록 조회는 세지 않음). 퍼널은
  방문→번호 생성→당첨 확인→2회차+ 생성 4단계(생성기 진입은 방문과 변별력이 낮아 표시 제외,
  수집은 유지). 기기 식별자는 제품과 같은
  `tyler_client_id`(localStorage, `lib/client-id.ts`)를 쓰며 IP·UA·원본 URL 은 저장하지 않는다.
  기기 행은 방문 비콘 또는 `/api/generate` 서버 적재 중 먼저 온 쪽이 만들며, 서버 적재가 앞서면
  first-touch 가 NULL(미상)로 시작하고 **첫 방문 비콘이 1회 채운다**(이후 동결; 어드민은 빈 값을 '미상'으로 표시)
  (개인정보처리방침 2026-08-29 개정 고지). 번호 선택 사용은 `generated_sets.picked_count`(과거
  null=미상 — 0 자동·1~5 반자동·6 수동·7+ '내 번호만 뽑기', 2026-09-02 `fixed_count` 에서 개명).
- **하이브리드 규약(boss-paegi v1.06 이식)**: 카운트류 = `analytics_rollups(day_kst<오늘)` +
  오늘 라이브 `analytics_rollup_rows_for_day(오늘)` — 하루치 집계 SQL 함수가 cron(INSERT)과
  어드민 라이브(SELECT)의 단일 소스. 윈도우 distinct 기기·회차 리텐션·성적표는 raw 직조회 RPC
  (`admin_funnel_window`·`gen_draw_retention`·`gen_draw_report` 등 — 일단위 분해가 안 되는 지표의
  예외). raw 이벤트 90일 보존(`prune_analytics_events`), 롤업·기기 레지스트리(`analytics_devices`,
  first-touch 동결)는 영구. 방문 계열 수집 시작(2026-08-29) 전 과거는 소급 불가, 생성 계열은
  `generated_sets` 영구라 전 기간 정확(도입 시 91일 롤업 백필 완료).
- **단위 규약(2026-08-29 v4)**: 표 안 "개수+비율"은 개수가 주·비율은 작은 보조 텍스트(단일 `Ratio`
  표기). 성적표 '공유'는 확인과 같은 **기기 단위·전 기간**(`gen_draw_report.share_devices` — 이벤트
  90일 관측 의존은 확인과 동일). 리텐션은 참여 회차 수 기준 2회차+/5회차+ 두 컬럼. 소비처가 없어진
  롤업 지표(share_by_draw·gen_fixed_sets·limit_hit_devices)와 생성 번호 균등성 RPC 는 제거
  (전부 `generated_sets` 영구 원본에서 재계산 가능 — 데이터 손실 없음).
- **유저 구성(2026-09-02 v6, GA식·일 단위)**: '유저활용'을 **유저 구성**으로 재편(퍼널 바로 뒤). 방문·생성
  각 층을 **처음/다시**로 분해(카드: 방문 기기·처음 방문·다시 방문 / 생성 기기·처음 생성·다시 생성 — 4자
  라벨은 375px 3열에서 한 줄 유지용) — 처음 = 첫 관측일(방문·생성 중 먼저 보인 날)이 기간 안(롤업
  `visit_new_devices`·`gen_new_devices`), 다시 = 기간 안에 첫날보다 뒤의 방문일/생성일이 있음(raw RPC
  `admin_engagement_window`: `returning_visit_devices`·`returning_gen_devices`). 기간 안에서 처음 오고 또 온
  기기는 둘 다에 세므로 합이 전체보다 클 수 있다(오늘 탭만 겹침 없음, 전체 탭은 처음=전체·다시=첫날 이후
  돌아온 기기). 구 '재방문 기기(창 안 2일 이상 방문)'는 오늘 탭이 구조적으로 0이고 과거 이력을 무시해 폐기.
  첫 관측일은 `analytics_devices` BEFORE INSERT 트리거가 `generated_sets` 최초 생성일과 비교해 이른 쪽을
  심는다(방문 수집 전에 생성만 했던 기기가 돌아올 때 '처음'으로 오판 방지) — 도입 시 이미 돌아와 있던 7대를
  백필하고 롤업 91일을 재계산. 생성 기기·처음 생성 카드는 생성분석에서 유저 구성으로 이동(한 숫자 한 자리).
- **메뉴 노출**: 어드민 로그인 성공(또는 인증된 /admin 렌더) 시 localStorage UI 힌트
  (`tyler_admin_ui`)를 심어 사이트 메뉴 **맨위**에 '운영 통계'를 노출한다 — 힌트는 노출용일 뿐
  권한이 아니며(실게이트=HttpOnly 쿠키), 일반 방문자에겐 보이지 않는다. `/admin` 방문은 방문
  통계에서 제외(운영 트래픽 오염 방지).
- **cron**: cron-job.org(emfoa23)가 `POST /api/ops/analytics-maintain`(x-cron-secret)을
  **KST 00:05 일 1회** 호출 — 자정 직후 앵커(하이브리드에서 '어제'가 롤업 관할로 넘어가는 경계 봉인).
  maintain(3일 delete-재계산, 멱등·advisory lock) → 성공 시 prune(90일).

## 운영 명령

```sh
node scripts/backfill.mjs all      # 전체 백필 — Actions 의 backfill 워크플로로도 dispatch 가능
node scripts/sync-draw.mjs         # 주간 동기화 (Actions 가 실행하는 것과 동일)
node scripts/sync-stores.mjs       # 마스터 동기화
```

배포는 **Vercel GitHub 연동**(2026-08-23 연결, production branch `main`) — PR 머지(= main push)마다 자동 프로덕션 배포,
PR 브랜치는 preview 배포. 수동이 필요하면 `vercel deploy --prod`(배포 권한이 있는 Vercel 계정으로 로그인 또는 `--token`).

## GitHub Secrets

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `OPS_SECRET` (revalidate/keepalive 게이트)
