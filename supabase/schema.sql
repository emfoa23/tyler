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
  order by count(*) desc, s.store_id asc
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
