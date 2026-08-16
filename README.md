# tyler — lottogen.click

로또 6/45 번호 생성 + 회차별 당첨 결과 + 명당(1·2등 배출점) 랭킹 서비스.

- **번호 생성** — 서버 무작위 생성, 기기별(localStorage 익명 id) 이력 저장
- **당첨 대조** — 생성 시점의 대상 회차(추첨 시각 토 20:35 KST 기준)로 귀속, 추첨 후 자동 대조
- **회차 히스토리** — 1회차(2002)부터 전 회차 당첨번호·등위별 당첨금
- **명당 랭킹 / 지점별 배출 이력** — 262회차(2007-12)부터의 1·2등 배출점 데이터 기반.
  온라인 채널(동행복권 사이트, `51100000`)도 랭킹에 포함하되 "온라인" 배지로 구분

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
  ├─ sync-draw    토 21:00/21:30/23:00 + 일 10:00 KST (멱등 재시도)
  │    당첨결과 upsert → 배출점 upsert → 생성번호 대조 → ISR revalidate
  ├─ sync-stores  일요일 새벽 주 1회 — 전국 판매점 마스터 upsert + 미출현 지점 closed 마킹
  └─ keepalive    매일 — GET /api/ops/keepalive (Supabase 무료 pause 방지)
```

## 데이터 소스

동행복권 공개 JSON API (2026-08 개편 후, 전부 GET·UTF-8):

- 회차별 당첨결과 `/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={회차}` — 요청 회차부터 아래로 10개
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

배포는 Vercel CLI 수동 배포(`npx vercel --prod`). GitHub 연동 자동 배포는 쓰지 않는다
(계정 단위 토큰을 레포에 넣지 않기 위해 — 원하면 Vercel GitHub App 설치로 전환 가능).

## GitHub Secrets

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `OPS_SECRET` (revalidate/keepalive 게이트)
