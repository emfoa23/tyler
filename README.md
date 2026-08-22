# tyler — lottogen.click

로또 6/45 번호 생성 + 회차별 당첨 결과 + 명당(1·2등 배출점) 순위 서비스.

- **번호 생성** — 서버 무작위 생성, 기기별(localStorage 익명 id) 이력 저장
- **당첨 대조** — 생성 시점의 대상 회차(추첨 시각 토 20:35 KST 기준)로 귀속, 추첨 후 자동 대조
- **회차 히스토리** — 1회차(2002)부터 전 회차 당첨번호·등위별 당첨금
- **명당 순위 / 지점별 배출 이력** — 262회차(2007-12)부터의 1·2등 배출점 데이터 기반.
  온라인 채널(동행복권 사이트, `51100000`)도 순위에 포함하되 "온라인" 배지로 구분

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
  ├─ sync-draw    토 20:50/21:05/21:30/23:05/23:30 + 일 10:00 KST (멱등 재시도)
  │    당첨결과 upsert → 배출점 upsert → 생성번호 대조 → ISR revalidate → IndexNow 핑
  ├─ sync-stores  일요일 새벽 주 1회 — 전국 판매점 마스터 upsert + 미출현 지점 closed 마킹
  └─ keepalive    매일 — GET /api/ops/keepalive (Supabase 무료 pause 방지)
```

## 검색 노출(SEO)

- 페이지 메타는 `lib/seo.ts` `pageMeta()` 단일 진입점 — title(`lottogen` 제외 15자)·description(30자 이내 행동 유도문, title 과 내용 중복 없음)·canonical·OG·Twitter 를 한 쌍의 값으로 채우고 og:image 는 전 페이지 공통 1장. 회차 상세 title/description 엔 당첨번호를 넣지 않는다(페이지에 들어와야 보이게, JSON-LD 에만). 명당은 `?sido=` 변형이 지역명 title + 자기 canonical.
- `app/sitemap.ts`: 핵심 페이지 + 17개 `?sido=` 명당 변형 + 전 회차 상세(지점 페이지는 제외 — ISR 폭증 방지). `public/robots.txt` 전체 허용 + sitemap.
- IndexNow(`scripts/lib/indexnow.mjs`, 키 파일 `public/<key>.txt`): sync-draw 가 변경을 반영하면 홈·목록·명당·번호·최신 회차 URL 을 핑(네이버·Bing 등 참여 엔진). Google 은 sitemap + Search Console.
- `public/llms.txt`: 페이지 패턴·데이터·갱신 주기(생성형 검색 인용용).

## 데이터 소스

동행복권 공개 JSON API (2026-08 개편 후, 전부 GET·UTF-8):

- 회차별 당첨결과 `/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={회차}` — 요청 회차부터 아래로 10개.
  1등 구매유형 `winType1/2/3` 은 공개 전(추첨 후 ~21:02)·데이터가 없는 261회차 이전에 null 이 아니라 0/0/0 으로 오므로 **합계 0 은 null 로 저장**한다
- 회차별 1·2등 배출점 `/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd={회차}` — 262회차부터, 행=당첨 게임 1건
- 전국 판매점 마스터 `/prchsplcsrch/selectLtShp.do?srchCtpvNm={시도}` — 시도는 짧은 이름("서울"), 페이지당 10건 고정

## 개발

```sh
npm install
npm run dev        # .env.local 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPS_SECRET
```

스키마는 `supabase/schema.sql` (Supabase Management API 로 적용).

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
