-- The public client has NO direct table or RPC writes. Only the verified Edge
-- handler gets service_role access; RLS and grants make this fail closed.
create table public.tw_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_id uuid not null default gen_random_uuid() unique,
  nickname text not null check (char_length(nickname) between 3 and 24 and nickname ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]+$'),
  blocked boolean not null default false,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index tw_players_nickname on public.tw_players(lower(nickname));
create table public.tw_scores (
  user_id uuid not null references public.tw_players(user_id) on delete cascade,
  board_key text not null check (char_length(board_key)<=140),
  rules text not null check (rules='0.6.0'),
  mode text not null check (mode in ('daily','free')),
  seed text not null check (seed ~ '^[-_A-Za-z0-9]{1,48}$'),
  specialty text not null check (specialty in ('independent','logistics','grid')),
  challenge_date date,
  company_name text not null check (char_length(company_name) between 1 and 40),
  score_cents bigint not null check (score_cents between 0 and 100000000000000),
  return_pct double precision not null,
  deliveries integer not null check (deliveries>=0),
  trades integer not null check (trades>=0),
  replay_hash text not null check (replay_hash ~ '^[0-9a-f]{64}$'),
  action_count integer not null check (action_count between 1 and 1200),
  proof jsonb not null,
  summary jsonb not null,
  hidden boolean not null default false,
  submitted_at timestamptz not null default now(),
  primary key (user_id,board_key),
  check ((mode='daily' and challenge_date is not null and specialty='independent' and seed='DAILY-'||challenge_date::text) or (mode='free' and challenge_date is null))
);
create index tw_scores_ranking on public.tw_scores(board_key,score_cents desc,submitted_at) where not hidden;
create table public.tw_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_at timestamptz not null default now(), minute_count integer not null default 0,
  day_at date not null default (now() at time zone 'UTC')::date, day_count integer not null default 0
);
alter table public.tw_players enable row level security;
alter table public.tw_scores enable row level security;
alter table public.tw_rate_limits enable row level security;
revoke all on public.tw_players,public.tw_scores,public.tw_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.tw_players,public.tw_scores,public.tw_rate_limits to service_role;

create function public.tw_gate(p_user uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare n timestamptz:=clock_timestamp(); d date:=(n at time zone 'UTC')::date; r public.tw_rate_limits;
begin
  insert into public.tw_rate_limits(user_id) values(p_user) on conflict do nothing;
  select * into r from public.tw_rate_limits where user_id=p_user for update;
  if exists(select 1 from public.tw_players where user_id=p_user and blocked) then return false; end if;
  if n-r.minute_at>=interval '1 minute' then r.minute_at:=n; r.minute_count:=0; end if;
  if r.day_at<>d then r.day_at:=d; r.day_count:=0; end if;
  if r.minute_count>=10 or r.day_count>=60 then return false; end if;
  update public.tw_rate_limits set minute_at=r.minute_at,minute_count=r.minute_count+1,day_at=r.day_at,day_count=r.day_count+1 where user_id=p_user;
  return true;
end $$;

create function public.tw_profile(p_user uuid,p_name text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.tw_players;
begin
  if p_name is not null then
    insert into public.tw_players(user_id,nickname) values(p_user,btrim(p_name))
      on conflict(user_id) do update set nickname=excluded.nickname where not tw_players.blocked;
  end if;
  select * into r from public.tw_players where user_id=p_user;
  if not found then return null; end if;
  return jsonb_build_object('id',r.public_id,'nickname',r.nickname,'blocked',r.blocked);
end $$;

create function public.tw_store_score(p_user uuid,p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_score public.tw_scores; meta jsonb:=p->'meta'; k text:=meta->>'boardKey';
begin
  -- Serialize submissions from the same player. Blocked/hidden rows cannot be
  -- resurrected by resubmitting or replacing a best result.
  perform 1 from public.tw_players where user_id=p_user and not blocked for update;
  if not found then raise exception 'Player profile unavailable'; end if;
  select * into old_score from public.tw_scores where user_id=p_user and board_key=k;
  if found and old_score.hidden then return jsonb_build_object('status','moderated'); end if;
  if found and old_score.score_cents >= (p->>'scoreCents')::bigint then
    return jsonb_build_object('status',case when old_score.replay_hash=p->>'hash' then 'duplicate' else 'best_kept' end,'scoreCents',old_score.score_cents);
  end if;
  insert into public.tw_scores(user_id,board_key,rules,mode,seed,specialty,challenge_date,company_name,score_cents,return_pct,deliveries,trades,replay_hash,action_count,proof,summary)
    values(p_user,k,meta->>'rules',meta->>'mode',meta->>'seed',meta->>'specialty',nullif(meta->>'challengeDate','')::date,p->>'companyName',(p->>'scoreCents')::bigint,(p->>'returnPct')::double precision,(p->>'deliveries')::integer,(p->>'trades')::integer,p->>'hash',(p->>'actionCount')::integer,p->'proof',p->'summary')
    on conflict(user_id,board_key) do update set company_name=excluded.company_name,score_cents=excluded.score_cents,return_pct=excluded.return_pct,deliveries=excluded.deliveries,trades=excluded.trades,replay_hash=excluded.replay_hash,action_count=excluded.action_count,proof=excluded.proof,summary=excluded.summary,submitted_at=now();
  return jsonb_build_object('status','accepted','scoreCents',(p->>'scoreCents')::bigint);
end $$;

create function public.tw_board(p_key text,p_user uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
with ranked as (
  select s.*,p.public_id,p.nickname,
    rank() over(order by score_cents desc) as place,
    row_number() over(order by score_cents desc,submitted_at,public_id) as ordinal
  from public.tw_scores s join public.tw_players p using(user_id)
  where board_key=p_key and not s.hidden and not p.blocked and not p.is_test
), safe as (
 select user_id,ordinal,score_cents,jsonb_build_object('rank',place,'playerId',public_id,'nickname',nickname,'companyName',company_name,'scoreCents',score_cents,'returnPct',return_pct,'deliveries',deliveries,'trades',trades,'submittedAt',submitted_at,'isYou',user_id=p_user) as item from ranked
)
select jsonb_build_object('entries',coalesce((select jsonb_agg(item order by ordinal) from safe where ordinal<=50),'[]'::jsonb),
 'total',(select count(*) from safe),'me',(select item from safe where user_id=p_user),
 'gapToNextCents',(select min(score_cents)-(select score_cents from safe where user_id=p_user) from safe where score_cents>(select score_cents from safe where user_id=p_user)),
 'limit',50);
$$;

create function public.tw_delete_scores(p_user uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  -- Moderation tombstones stay to prevent un-hiding blocked entries. User-owned
  -- public results and replay proofs are erased, without touching the local run.
  delete from public.tw_scores where user_id=p_user and not hidden; get diagnostics n=row_count;
  return n;
end $$;
revoke execute on function public.tw_gate(uuid),public.tw_profile(uuid,text),public.tw_store_score(uuid,jsonb),public.tw_board(text,uuid),public.tw_delete_scores(uuid) from public,anon,authenticated;
grant execute on function public.tw_gate(uuid),public.tw_profile(uuid,text),public.tw_store_score(uuid,jsonb),public.tw_board(text,uuid),public.tw_delete_scores(uuid) to service_role;
