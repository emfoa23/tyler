-- tyler v2 schema (2026-08-16)
create table draws (
  draw_no        integer primary key,
  draw_date      date not null,
  n1 smallint not null, n2 smallint not null, n3 smallint not null,
  n4 smallint not null, n5 smallint not null, n6 smallint not null,
  bonus smallint not null,
  r1_winners integer, r1_prize_each bigint, r1_prize_total bigint,
  r2_winners integer, r2_prize_each bigint, r2_prize_total bigint,
  r3_winners integer, r3_prize_each bigint, r3_prize_total bigint,
  r4_winners integer, r4_prize_each bigint, r4_prize_total bigint,
  r5_winners integer, r5_prize_each bigint, r5_prize_total bigint,
  first_auto integer, first_manual integer, first_semi integer,
  sales_total bigint,
  prize_pool bigint,
  synced_at timestamptz not null default now()
);

create table stores (
  store_id text primary key,
  name text not null,
  sido text,
  sigungu text,
  address text,
  phone text,
  lat double precision,
  lng double precision,
  status text not null default 'open' check (status in ('open','closed')),
  sells_l645 boolean,
  master_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_sido_idx on stores (sido);

create table store_wins (
  id bigint generated always as identity primary key,
  draw_no integer not null references draws (draw_no) on delete cascade,
  store_id text not null references stores (store_id),
  rank smallint not null check (rank in (1, 2)),
  method text,
  draw_date date not null
);
create index store_wins_draw_idx on store_wins (draw_no);
create index store_wins_store_idx on store_wins (store_id, draw_date desc);
create index store_wins_date_idx on store_wins (draw_date desc);

create table generated_sets (
  id bigint generated always as identity primary key,
  client_id uuid not null,
  numbers smallint[] not null,
  target_draw integer not null,
  matched_rank smallint,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint numbers_shape check (array_length(numbers, 1) = 6)
);
create index generated_sets_client_idx on generated_sets (client_id, created_at desc);
create index generated_sets_unchecked_idx on generated_sets (target_draw) where checked_at is null;

alter table draws enable row level security;
alter table stores enable row level security;
alter table store_wins enable row level security;
alter table generated_sets enable row level security;

-- 기간 필터는 월 단위(p_months: 6·12·60). 파라미터명 변경은 CREATE OR REPLACE 불가라
-- 재배포 시 DROP 후 재생성 + GRANT 재적용이 필요하다 (2026-08-20 p_years→p_months 전환).
create or replace function store_ranking(
  p_rank text default 'all',
  p_months integer default null,
  p_sido text default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns table (
  store_id text, name text, sido text, sigungu text, address text, status text,
  r1 bigint, r2 bigint, total bigint, last_win date
) language sql stable as $$
  select s.store_id, s.name, s.sido, s.sigungu, s.address, s.status,
         count(*) filter (where w.rank = 1) as r1,
         count(*) filter (where w.rank = 2) as r2,
         count(*) as total,
         max(w.draw_date) as last_win
  from store_wins w
  join stores s on s.store_id = w.store_id
  where (p_rank = 'all' or w.rank = p_rank::smallint)
    and (p_months is null or w.draw_date >= (current_date - make_interval(months => p_months)))
    -- 온라인 채널(51100000)은 특정 시도 소속이 아니므로 지역 필터에선 제외, 전국일 때만 포함
    and (p_sido is null or (s.sido = p_sido and s.store_id <> '51100000'))
  group by s.store_id
  -- 1등 우선, 동률은 2등 순 — rank 필터 모드에선 해당 등수 count 만 남아 자연히 그 등수 desc 가 된다
  order by count(*) filter (where w.rank = 1) desc,
           count(*) filter (where w.rank = 2) desc,
           s.store_id asc
  limit p_limit offset p_offset
$$;

create or replace function generation_stats()
returns table (total bigint, checked bigint, r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint)
language sql stable as $$
  select count(*),
         count(*) filter (where checked_at is not null),
         count(*) filter (where matched_rank = 1),
         count(*) filter (where matched_rank = 2),
         count(*) filter (where matched_rank = 3),
         count(*) filter (where matched_rank = 4),
         count(*) filter (where matched_rank = 5)
  from generated_sets
$$;

create or replace function check_generated_sets(p_draw integer)
returns integer language plpgsql as $$
declare v_count integer;
begin
  update generated_sets g
  set matched_rank = sub.rank, checked_at = now()
  from (
    select g2.id,
      case
        when m.cnt = 6 then 1
        when m.cnt = 5 and d.bonus = any (g2.numbers) then 2
        when m.cnt = 5 then 3
        when m.cnt = 4 then 4
        when m.cnt = 3 then 5
        else 0
      end as rank
    from generated_sets g2
    join draws d on d.draw_no = g2.target_draw
    cross join lateral (
      select count(*) as cnt from unnest(g2.numbers) n
      where n in (d.n1, d.n2, d.n3, d.n4, d.n5, d.n6)
    ) m
    where g2.target_draw = p_draw and g2.checked_at is null
  ) sub
  where g.id = sub.id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function store_ranking(text, integer, text, integer, integer) from public, anon, authenticated;
revoke execute on function generation_stats() from public, anon, authenticated;
revoke execute on function check_generated_sets(integer) from public, anon, authenticated;
grant execute on function store_ranking(text, integer, text, integer, integer) to service_role;
grant execute on function generation_stats() to service_role;
grant execute on function check_generated_sets(integer) to service_role;

-- 번호별 출현 통계. p_bonus 는 시그니처 변경 마이그레이션을 피하려고 처음부터 포함(2026-08-20).
create or replace function number_frequency(
  p_months integer default null,
  p_bonus boolean default false
) returns table (num smallint, cnt bigint, last_draw integer, last_date date)
language sql stable as $$
  with pool as (
    select d.draw_no, d.draw_date, x.num
    from draws d
    cross join lateral unnest(
      case when p_bonus
        then array[d.n1, d.n2, d.n3, d.n4, d.n5, d.n6, d.bonus]
        else array[d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]
      end
    ) as x(num)
    where p_months is null or d.draw_date >= (current_date - make_interval(months => p_months))
  )
  select n.num::smallint,
         count(p.num) as cnt,
         max(p.draw_no) as last_draw,
         max(p.draw_date) as last_date
  from generate_series(1, 45) as n(num)
  left join pool p on p.num = n.num
  group by n.num
  order by count(p.num) desc, n.num asc
$$;

revoke execute on function number_frequency(integer, boolean) from public, anon, authenticated;
grant execute on function number_frequency(integer, boolean) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 분석·어드민 (2026-08-29) — boss-paegi v1.06 하이브리드 규약의 축소 이식.
-- 규약: 어드민 [오늘|7일|30일|전체] KST 달력일 / 오늘 = analytics_rollup_rows_for_day(오늘)
-- 라이브 / 어제까지 = analytics_rollups(day_kst < 오늘)만 — 하루치 집계 함수가 cron(INSERT)과
-- 라이브(SELECT)의 단일 소스. 윈도우 distinct 기기·리텐션 커브·성적표는 raw 직조회 RPC
-- (이벤트 90일·generated_sets 영구 — 일단위 분해 불가한 지표의 정직한 예외).
-- 방문 이벤트는 제품의 기기 식별자(client_id, localStorage 'tyler_client_id')와 결합하며
-- 개인정보처리방침에 고지한다(집계 전용·IP/UA 무저장). 전부 server-only(RLS deny-all).
-- 이 블록은 멱등(if not exists / or replace) — Management API 로 그대로 재적용 가능.
-- ═══════════════════════════════════════════════════════════════════════════

-- 반자동(고정번호) 사용 기록 — 과거 행 null=미상(컬럼 도입 전), 이후 0~5.
alter table generated_sets add column if not exists fixed_count smallint;

create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day_kst date not null,
  client_id uuid not null,
  kind text not null check (kind in ('visit', 'generate_view', 'check')),
  -- check = '당첨만 보기'로 이미 추첨된 참여 회차 결과를 본 행위(GET /api/generate wins=1 서버 적재, 2026-08-29 재정의)
  landing text,                     -- visit: 랜딩 페이지 그룹(home|generate|history|stores|numbers|about|privacy|other)
  src_kind text, src_value text,    -- visit: current(이번 진입) 소스 — direct|referrer|utm + 정규화 값
  ft_kind text, ft_value text       -- visit: first-touch(최초 획득) 소스
);
create index if not exists analytics_events_day_kind_idx on analytics_events (day_kst, kind);
create index if not exists analytics_events_day_client_idx on analytics_events (day_kst, client_id);
create index if not exists analytics_events_client_idx on analytics_events (client_id, day_kst);
alter table analytics_events enable row level security;

create or replace function analytics_events_set_day_kst() returns trigger language plpgsql as $$
begin
  new.day_kst := (new.created_at at time zone 'Asia/Seoul')::date;
  return new;
end $$;
drop trigger if exists trg_analytics_events_day_kst on analytics_events;
create trigger trg_analytics_events_day_kst before insert on analytics_events
  for each row execute function analytics_events_set_day_kst();

-- 기기 레지스트리(영구) — '전체' 윈도우 퍼널·first-touch 귀속의 정본. raw 90일 prune 과 무관.
create table if not exists analytics_devices (
  client_id uuid primary key,
  first_seen_day date not null,
  last_seen_day date not null,
  first_landing text,
  ft_kind text, ft_value text,          -- 최초 방문 시 동결(획득 귀속)
  first_generate_view_day date,
  first_check_day date,
  first_gen_day date,
  last_gen_day date
);
create index if not exists analytics_devices_first_seen_idx on analytics_devices (first_seen_day);
alter table analytics_devices enable row level security;

create table if not exists analytics_rollups (
  day_kst date not null,
  metric text not null,
  dim1 text not null default '',
  dim2 text not null default '',
  value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day_kst, metric, dim1, dim2)
);
alter table analytics_rollups enable row level security;

-- ── 하루치 집계 단일 소스(day-additive 지표만 — cron 과 어드민 오늘 라이브가 공유) ──
create or replace function analytics_rollup_rows_for_day(p_day date)
returns table (metric text, dim1 text, dim2 text, value bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_lo timestamptz;
  v_hi timestamptz;
begin
  if p_day is null then
    raise exception 'analytics_rollup_rows_for_day_invalid_day' using errcode = '22023';
  end if;
  v_lo := (p_day::timestamp at time zone 'Asia/Seoul');
  v_hi := ((p_day + 1)::timestamp at time zone 'Asia/Seoul');
  return query
  select 'visit_total'::text, ''::text, ''::text, count(*)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day
  union all
  select 'visit_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day
  union all
  select 'visit_new_devices', '', '', count(*)::bigint
    from analytics_devices d where d.first_seen_day = p_day
  union all
  select 'visit_by_landing', coalesce(e.landing, ''), '', count(*)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day group by e.landing
  union all
  select 'visit_by_src', coalesce(e.src_kind, ''), coalesce(e.src_value, ''), count(*)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day group by e.src_kind, e.src_value
  union all
  select 'acq_new_by_ft', coalesce(d.ft_kind, ''), coalesce(d.ft_value, ''), count(*)::bigint
    from analytics_devices d where d.first_seen_day = p_day group by d.ft_kind, d.ft_value
  union all
  select 'generate_view_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind = 'generate_view' and e.day_kst = p_day
  union all
  select 'check_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind = 'check' and e.day_kst = p_day
  union all
  select 'gen_sets', '', '', count(*)::bigint
    from generated_sets g where g.created_at >= v_lo and g.created_at < v_hi
  union all
  select 'gen_devices', '', '', count(distinct g.client_id)::bigint
    from generated_sets g where g.created_at >= v_lo and g.created_at < v_hi
  union all
  select 'gen_new_devices', '', '', count(*)::bigint from (
    select g.client_id, min(g.created_at) as mc from generated_sets g group by g.client_id
  ) t where t.mc >= v_lo and t.mc < v_hi
  union all
  select 'gen_fixed_sets', '', '', count(*)::bigint
    from generated_sets g
    where g.created_at >= v_lo and g.created_at < v_hi and coalesce(g.fixed_count, 0) > 0
  union all
  select 'gen_by_target', g.target_draw::text, '', count(*)::bigint
    from generated_sets g where g.created_at >= v_lo and g.created_at < v_hi group by g.target_draw
  union all
  select 'limit_hit_devices', '', '', count(*)::bigint from (
    select g.client_id from generated_sets g
    where g.created_at >= v_lo and g.created_at < v_hi
    group by g.client_id having count(*) >= 200
  ) t;
end $$;

create or replace function maintain_analytics_rollups(p_days integer default 3)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_min_days constant integer := 1;
  c_max_days constant integer := 91;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_d date;
  i integer;
begin
  if p_days is null or p_days not between c_min_days and c_max_days then
    raise exception 'maintain_analytics_rollups_invalid_days' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('analytics_rollups'));
  for i in 0 .. p_days - 1 loop
    v_d := v_today - i;
    delete from analytics_rollups where day_kst = v_d;
    insert into analytics_rollups (day_kst, metric, dim1, dim2, value, updated_at)
    select v_d, r.metric, r.dim1, r.dim2, r.value, now()
    from analytics_rollup_rows_for_day(v_d) r;
  end loop;
  return jsonb_build_object('ok', true, 'days', p_days);
end $$;

create or replace function prune_analytics_events(p_retention_days integer default 90)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_min constant integer := 1;
  c_max constant integer := 90;
  v_cutoff date;
  v_deleted integer := 0;
begin
  if p_retention_days is null or p_retention_days not between c_min and c_max then
    raise exception 'prune_analytics_events_invalid_retention_days' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('analytics_rollups'));
  v_cutoff := (now() at time zone 'Asia/Seoul')::date - p_retention_days;
  delete from analytics_events where day_kst < v_cutoff;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'cutoff', v_cutoff);
end $$;

-- ── 윈도우 distinct 기기 지표(raw 직조회 — 일단위 분해 불가) · p_days null=전체 ──
create or replace function admin_funnel_window(p_days integer default null)
returns table (stage text, devices bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
  v_from_ts timestamptz;
begin
  if p_days is not null and p_days not between 1 and 90 then
    raise exception 'admin_funnel_window_invalid_days' using errcode = '22023';
  end if;
  v_from := case when p_days is null then null else v_today - (p_days - 1) end;
  v_from_ts := case when v_from is null then null else (v_from::timestamp at time zone 'Asia/Seoul') end;
  return query
  -- 방문: 전체=기기 레지스트리(영구 정확) / 윈도우=raw(90일 내 정확)
  select 'visit'::text, case when p_days is null
    then (select count(*) from analytics_devices)
    else (select count(distinct e.client_id) from analytics_events e where e.kind = 'visit' and e.day_kst >= v_from) end
  union all
  select 'generate_view', case when p_days is null
    then (select count(*) from analytics_devices d where d.first_generate_view_day is not null)
    else (select count(distinct e.client_id) from analytics_events e where e.kind = 'generate_view' and e.day_kst >= v_from) end
  union all
  select 'generated', case when p_days is null
    then (select count(distinct g.client_id) from generated_sets g)
    else (select count(distinct g.client_id) from generated_sets g where g.created_at >= v_from_ts) end
  union all
  select 'checked', case when p_days is null
    then (select count(*) from analytics_devices d where d.first_check_day is not null)
    else (select count(distinct e.client_id) from analytics_events e where e.kind = 'check' and e.day_kst >= v_from) end
  union all
  -- 2회차+ 생성: 윈도우 내 생성 기기 중 평생 참여 회차가 2개 이상(회차 리텐션 도달)
  select 'multi_draw', (
    select count(*) from (
      select g.client_id from generated_sets g
      where v_from_ts is null or g.created_at >= v_from_ts
      group by g.client_id
    ) w where (
      select count(distinct g2.target_draw) from generated_sets g2 where g2.client_id = w.client_id
    ) >= 2
  );
end $$;

create or replace function admin_engagement_window(p_days integer default null)
returns table (metric text, devices bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
begin
  if p_days is not null and p_days not between 1 and 90 then
    raise exception 'admin_engagement_window_invalid_days' using errcode = '22023';
  end if;
  v_from := case when p_days is null then null else v_today - (p_days - 1) end;
  return query
  -- 재방문 기기: 전체=첫날 이후 다시 온 기기(레지스트리) / 윈도우=2일 이상 방문한 기기(raw)
  select 'returning_visit_devices'::text, case when p_days is null
    then (select count(*) from analytics_devices d where d.last_seen_day > d.first_seen_day)
    else (select count(*) from (
      select e.client_id from analytics_events e
      where e.kind = 'visit' and e.day_kst >= v_from
      group by e.client_id having count(distinct e.day_kst) >= 2
    ) t) end;
end $$;

-- first-touch 소스별 기기 획득→활성 전환(레지스트리 기반 — 영구 정확)
create or replace function acq_ft_conversion(p_days integer default null)
returns table (ft_kind text, ft_value text, devices bigint, gen_devices bigint, check_devices bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
begin
  if p_days is not null and p_days not between 1 and 90 then
    raise exception 'acq_ft_conversion_invalid_days' using errcode = '22023';
  end if;
  v_from := case when p_days is null then null else v_today - (p_days - 1) end;
  return query
  select coalesce(d.ft_kind, ''), coalesce(d.ft_value, ''),
    count(*)::bigint,
    count(*) filter (where d.first_gen_day is not null)::bigint,
    count(*) filter (where d.first_check_day is not null)::bigint
  from analytics_devices d
  where v_from is null or d.first_seen_day >= v_from
  group by d.ft_kind, d.ft_value
  order by count(*) desc;
end $$;

-- 회차 코호트 리텐션: 첫 참여 회차별 기기 수 + 참여 회차 수 2개/5개 이상 기기
-- (v4 재정의: %만 있던 +1/+2/+3회차 컬럼 제거, 2회차+와 같은 포맷의 5회차+ 추가 — 시그니처 변경이라 drop)
drop function if exists gen_draw_retention(integer);
create function gen_draw_retention(p_cohorts integer default 8)
returns table (cohort_draw integer, devices bigint, again_any bigint, deep5 bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_cohorts is null or p_cohorts not between 1 and 52 then
    raise exception 'gen_draw_retention_invalid_cohorts' using errcode = '22023';
  end if;
  return query
  with firsts as (
    select g.client_id, min(g.target_draw) as cohort, count(distinct g.target_draw) as ndraws
    from generated_sets g group by g.client_id
  )
  select f.cohort, count(*)::bigint,
    count(*) filter (where f.ndraws >= 2)::bigint,
    count(*) filter (where f.ndraws >= 5)::bigint
  from firsts f
  group by f.cohort
  order by f.cohort desc
  limit p_cohorts;
end $$;

-- 회차별 성적표 + 추첨 후 7일 내 '당첨만 보기' 확인 기기(참여 기기 한정)
-- (v4 재정의: 공유도 확인과 같은 기기 단위·전 기간 — share_devices. 이벤트 90일 prune 의존은 확인과 동일)
drop function if exists gen_draw_report(integer);
create function gen_draw_report(p_draws integer default 8)
returns table (
  draw_no integer, participants bigint, sets bigint, checked_sets bigint,
  r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint, post_check_devices bigint,
  share_devices bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_draws is null or p_draws not between 1 and 52 then
    raise exception 'gen_draw_report_invalid_draws' using errcode = '22023';
  end if;
  return query
  with recent as (
    select g.target_draw from generated_sets g group by g.target_draw order by g.target_draw desc limit p_draws
  )
  select r.target_draw,
    a.participants, a.sets, a.checked_sets, a.r1, a.r2, a.r3, a.r4, a.r5,
    coalesce(c.post_check, 0), coalesce(sh.share_devs, 0)
  from recent r
  left join lateral (
    select count(distinct g.client_id) as participants, count(*) as sets,
      count(*) filter (where g.checked_at is not null) as checked_sets,
      count(*) filter (where g.matched_rank = 1) as r1,
      count(*) filter (where g.matched_rank = 2) as r2,
      count(*) filter (where g.matched_rank = 3) as r3,
      count(*) filter (where g.matched_rank = 4) as r4,
      count(*) filter (where g.matched_rank = 5) as r5
    from generated_sets g where g.target_draw = r.target_draw
  ) a on true
  left join lateral (
    select count(distinct e.client_id) as post_check
    from draws d
    join analytics_events e on e.kind = 'check'
      and e.day_kst between d.draw_date and d.draw_date + 7
    where d.draw_no = r.target_draw
      and exists (
        select 1 from generated_sets g2
        where g2.client_id = e.client_id and g2.target_draw = r.target_draw
      )
  ) c on true
  left join lateral (
    select count(distinct e.client_id) as share_devs
    from analytics_events e
    where e.kind in ('share', 'share_download') and e.draw_no = r.target_draw
  ) sh on true
  order by r.target_draw desc;
end $$;

-- 기기당 생성 세트수 분포(윈도우)
create or replace function gen_device_depth(p_days integer default null)
returns table (bucket text, devices bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from_ts timestamptz;
begin
  if p_days is not null and p_days not between 1 and 90 then
    raise exception 'gen_device_depth_invalid_days' using errcode = '22023';
  end if;
  v_from_ts := case when p_days is null then null
    else ((v_today - (p_days - 1))::timestamp at time zone 'Asia/Seoul') end;
  return query
  with per as (
    select g.client_id, count(*) as n from generated_sets g
    where v_from_ts is null or g.created_at >= v_from_ts
    group by g.client_id
  )
  select case
      when per.n = 1 then '1'
      when per.n <= 5 then '2-5'
      when per.n <= 20 then '6-20'
      when per.n <= 100 then '21-100'
      else '101+'
    end, count(*)::bigint
  from per group by 1;
end $$;

revoke execute on function analytics_rollup_rows_for_day(date) from public, anon, authenticated;
revoke execute on function maintain_analytics_rollups(integer) from public, anon, authenticated;
revoke execute on function prune_analytics_events(integer) from public, anon, authenticated;
revoke execute on function admin_funnel_window(integer) from public, anon, authenticated;
revoke execute on function admin_engagement_window(integer) from public, anon, authenticated;
revoke execute on function acq_ft_conversion(integer) from public, anon, authenticated;
revoke execute on function gen_draw_retention(integer) from public, anon, authenticated;
revoke execute on function gen_draw_report(integer) from public, anon, authenticated;
revoke execute on function gen_device_depth(integer) from public, anon, authenticated;
grant execute on function analytics_rollup_rows_for_day(date) to service_role;
grant execute on function maintain_analytics_rollups(integer) to service_role;
grant execute on function prune_analytics_events(integer) to service_role;
grant execute on function admin_funnel_window(integer) to service_role;
grant execute on function admin_engagement_window(integer) to service_role;
grant execute on function acq_ft_conversion(integer) to service_role;
grant execute on function gen_draw_retention(integer) to service_role;
grant execute on function gen_draw_report(integer) to service_role;
grant execute on function gen_device_depth(integer) to service_role;

-- ── 자랑하기·바이럴 루프 (2026-08-29 v2) ─────────────────────────────────────
-- 생명주기: 진입→생성→(추첨 후) 당첨만 보기 확인→자랑하기(Web Share: 이미지+text 링크)→
-- /share/{draw} 랜딩(viral 소스)→생성 전환. 멱등 블록 — Management API 재적용 가능.

alter table analytics_events add column if not exists draw_no integer;  -- share 계열만 사용
alter table analytics_events drop constraint if exists analytics_events_kind_check;
alter table analytics_events add constraint analytics_events_kind_check
  check (kind in ('visit', 'generate_view', 'check', 'share', 'share_download'));
-- share = Web Share 완료(이미지+링크), share_download = 미지원 폴백(이미지 저장+링크 복사).
-- visit 의 src/ft kind 에 'viral'(랜딩 /share/{draw} — 레퍼러 아닌 경로 판정) 추가는 제약 없음(자유 text).

alter table analytics_devices add column if not exists first_share_day date;

create or replace function analytics_rollup_rows_for_day(p_day date)
returns table (metric text, dim1 text, dim2 text, value bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_lo timestamptz;
  v_hi timestamptz;
begin
  if p_day is null then
    raise exception 'analytics_rollup_rows_for_day_invalid_day' using errcode = '22023';
  end if;
  v_lo := (p_day::timestamp at time zone 'Asia/Seoul');
  v_hi := ((p_day + 1)::timestamp at time zone 'Asia/Seoul');
  return query
  select 'visit_total'::text, ''::text, ''::text, count(*)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day
  union all
  select 'visit_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day
  union all
  select 'visit_new_devices', '', '', count(*)::bigint
    from analytics_devices d where d.first_seen_day = p_day
  union all
  select 'visit_by_landing', coalesce(e.landing, ''), '', count(*)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day group by e.landing
  union all
  select 'visit_by_src', coalesce(e.src_kind, ''), coalesce(e.src_value, ''), count(*)::bigint
    from analytics_events e where e.kind = 'visit' and e.day_kst = p_day group by e.src_kind, e.src_value
  union all
  select 'acq_new_by_ft', coalesce(d.ft_kind, ''), coalesce(d.ft_value, ''), count(*)::bigint
    from analytics_devices d where d.first_seen_day = p_day group by d.ft_kind, d.ft_value
  union all
  select 'generate_view_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind = 'generate_view' and e.day_kst = p_day
  union all
  select 'check_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind = 'check' and e.day_kst = p_day
  union all
  -- 자랑하기 실행(공유·저장 폴백 합산 기기/건수)
  select 'share_devices', '', '', count(distinct e.client_id)::bigint
    from analytics_events e where e.kind in ('share', 'share_download') and e.day_kst = p_day
  union all
  select 'share_actions', e.kind, '', count(*)::bigint
    from analytics_events e where e.kind in ('share', 'share_download') and e.day_kst = p_day group by e.kind
  union all
  select 'gen_sets', '', '', count(*)::bigint
    from generated_sets g where g.created_at >= v_lo and g.created_at < v_hi
  union all
  select 'gen_devices', '', '', count(distinct g.client_id)::bigint
    from generated_sets g where g.created_at >= v_lo and g.created_at < v_hi
  union all
  select 'gen_new_devices', '', '', count(*)::bigint from (
    select g.client_id, min(g.created_at) as mc from generated_sets g group by g.client_id
  ) t where t.mc >= v_lo and t.mc < v_hi
  union all
  select 'gen_by_target', g.target_draw::text, '', count(*)::bigint
    from generated_sets g where g.created_at >= v_lo and g.created_at < v_hi group by g.target_draw;
end $$;

-- 바이럴 루프 지표(윈도우 distinct — raw 직조회, p_days null=전체)
create or replace function admin_viral_loop(p_days integer default null)
returns table (metric text, devices bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_from date;
begin
  if p_days is not null and p_days not between 1 and 90 then
    raise exception 'admin_viral_loop_invalid_days' using errcode = '22023';
  end if;
  v_from := case when p_days is null then null else v_today - (p_days - 1) end;
  return query
  -- 자랑 실행 기기(공유+저장): 전체=레지스트리 / 윈도우=raw
  select 'share_devices'::text, case when p_days is null
    then (select count(*) from analytics_devices d where d.first_share_day is not null)
    else (select count(distinct e.client_id) from analytics_events e
          where e.kind in ('share', 'share_download') and e.day_kst >= v_from) end
  union all
  -- 공유 링크로 획득된 신규 기기(first-touch=viral)
  select 'viral_new_devices', (
    select count(*) from analytics_devices d
    where d.ft_kind = 'viral' and (v_from is null or d.first_seen_day >= v_from))
  union all
  -- 그중 생성까지 간 기기(루프 완성)
  select 'viral_gen_devices', (
    select count(*) from analytics_devices d
    where d.ft_kind = 'viral' and d.first_gen_day is not null
      and (v_from is null or d.first_seen_day >= v_from));
end $$;

revoke execute on function admin_viral_loop(integer) from public, anon, authenticated;
grant execute on function admin_viral_loop(integer) to service_role;

-- ── 자랑 공유 토큰 (2026-08-29 v3) ──────────────────────────────────────────
-- 공유 링크는 "그 사람의 당첨 내역" 페이지로 랜딩해야 한다(사용자 확정). client_id 를 URL 에
-- 노출하면 공개 GET(clientId 기반)으로 전체 이력이 열리므로, 자랑 시점에 무작위 토큰을 발급해
-- 토큰→(기기, 회차)만 가리키게 한다. (기기, 회차) 당 1행 upsert — 반복 자랑도 같은 URL.
create table if not exists shares (
  token text primary key,
  client_id uuid not null,
  draw_no integer not null,
  created_at timestamptz not null default now(),
  unique (client_id, draw_no)
);
alter table shares enable row level security;

-- ── 통계 단위 정합 (2026-08-29 v4) ──────────────────────────────────────────
-- 성적표 공유 열이 이벤트 횟수·어드민 윈도우 종속이던 것을 확인 열과 같은
-- 기기 단위·전 기간(gen_draw_report.share_devices)으로 통일. 리텐션은 %만 있던
-- +1/+2/+3회차 컬럼을 제거하고 5회차+ 추가(위 두 함수 v4 재정의 주석 참조).
-- 소비처 0 이 된 지표는 적재 중단(rows_for_day 재정의) + 기존 행 정리:
-- share_by_draw(성적표가 share_devices 로 전환), gen_fixed_sets·limit_hit_devices(카드 제거,
-- 사용자 결정 "유의미하지 않음" — generated_sets 영구 원본에서 언제든 재계산 가능).
-- 생성 번호 균등성 블록도 사용자 결정으로 통삭제(RPC 포함).
delete from analytics_rollups where metric in ('share_by_draw', 'gen_fixed_sets', 'limit_hit_devices');
drop function if exists generated_number_frequency();
