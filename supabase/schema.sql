create extension if not exists "pgcrypto";

create table if not exists public.teams (
  code text primary key,
  short_label text not null,
  name_ko text not null,
  primary_color text not null
);

insert into public.teams (code, short_label, name_ko, primary_color) values
  ('HH', 'HH', '한화', '#ea580c'),
  ('HT', 'KIA', 'KIA', '#dc2626'),
  ('SS', 'SS', '삼성', '#1d4ed8'),
  ('LG', 'LG', 'LG', '#9f1239'),
  ('OB', 'OB', '두산', '#1e3a5f'),
  ('LT', 'LT', '롯데', '#be123c'),
  ('SK', 'SSG', 'SSG', '#e11d48'),
  ('WO', 'WO', '키움', '#a21caf'),
  ('KT', 'KT', 'KT', '#111827'),
  ('NC', 'NC', 'NC', '#ca8a04')
on conflict (code) do update set
  short_label = excluded.short_label,
  name_ko = excluded.name_ko,
  primary_color = excluded.primary_color;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  game_id text not null unique,
  season int not null,
  game_date date not null,
  game_time text,
  stadium text,
  away_team_code text not null references public.teams(code),
  home_team_code text not null references public.teams(code),
  away_score int,
  home_score int,
  winner_team_code text references public.teams(code),
  game_status text,
  away_starter_name text,
  home_starter_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_games_date on public.games (game_date);
create index if not exists idx_games_teams on public.games (home_team_code, away_team_code);

create table if not exists public.players (
  id text primary key,
  name text not null,
  team_code text references public.teams(code),
  back_number int,
  position text,
  bats_throws text,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_player_stats (
  id uuid primary key default gen_random_uuid(),
  game_uuid uuid not null references public.games(id) on delete cascade,
  player_id text,
  player_name text not null,
  team_code text not null references public.teams(code),
  role text not null check (role in ('batter', 'pitcher')),
  is_starter boolean not null default false,
  at_bats int,
  hits int,
  doubles int,
  triples int,
  home_runs int,
  rbi int,
  runs int,
  walks int,
  strikeouts int,
  stolen_bases int,
  innings_pitched_outs int,
  earned_runs int,
  hits_allowed int,
  walks_allowed int,
  wins int,
  losses int,
  saves int,
  holds int,
  unique (game_uuid, player_name, team_code, role)
);

create index if not exists idx_gps_game on public.game_player_stats (game_uuid);
create index if not exists idx_gps_player on public.game_player_stats (team_code, player_name);

create table if not exists public.roster_moves (
  id uuid primary key default gen_random_uuid(),
  move_date date not null,
  team_code text not null references public.teams(code),
  player_name text not null,
  back_number int,
  position text,
  bats_throws text,
  move_type text not null check (move_type in ('register', 'deregister')),
  unique (move_date, team_code, player_name, move_type)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  display_alias text,
  avatar_url text,
  email text,
  favorite_team_code text references public.teams(code),
  is_blocked boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.user_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create index if not exists idx_attendance_user on public.user_attendance (user_id);
create index if not exists idx_gm_user on public.group_members (user_id);

alter table public.teams enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.game_player_stats enable row level security;
alter table public.roster_moves enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.user_attendance enable row level security;

create policy "read teams" on public.teams for select to authenticated using (true);
create policy "read games" on public.games for select to authenticated using (true);
create policy "read players" on public.players for select to authenticated using (true);
create policy "read stats" on public.game_player_stats for select to authenticated using (true);
create policy "read moves" on public.roster_moves for select to authenticated using (true);

create policy "profiles select own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "groups select member" on public.groups
  for select to authenticated
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid()
  ));

create policy "groups insert" on public.groups
  for insert to authenticated with check (created_by = auth.uid());

create policy "group_members select mine" on public.group_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members me
      where me.group_id = group_members.group_id and me.user_id = auth.uid()
    )
  );

create policy "attendance own" on public.user_attendance
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '회원'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public._random_invite_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.groups g where g.invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_club_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), public._random_invite_code(), auth.uid())
  returning * into g;
  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'owner');
  return g;
end;
$$;

create or replace function public.join_club_group(p_invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into g from public.groups where invite_code = upper(trim(p_invite_code));
  if g.id is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict do nothing;
  return g;
end;
$$;

create or replace function public.leave_club_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.group_members
  where group_id = p_group_id and user_id = auth.uid();
end;
$$;

create or replace function public.list_my_groups()
returns setof public.groups
language sql
security definer
set search_path = public
as $$
  select g.*
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid()
  order by g.created_at desc;
$$;

create or replace function public.list_group_members(p_group_id uuid)
returns table (user_id uuid, role text, display_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'not a member';
  end if;
  return query
  select gm.user_id, gm.role, coalesce(p.display_alias, p.display_name, '회원')
  from public.group_members gm
  left join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
  order by gm.joined_at;
end;
$$;

create or replace function public.get_group_leaderboard(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  games int,
  wins int,
  losses int,
  draws int,
  win_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'not a member';
  end if;
  return query
  with att as (
    select ua.user_id, g.*
    from public.user_attendance ua
    join public.games g on g.id = ua.game_id
    join public.group_members gm on gm.user_id = ua.user_id and gm.group_id = p_group_id
    join public.profiles pr on pr.id = ua.user_id
    where g.away_score is not null and g.home_score is not null
      and coalesce(g.game_status, '') !~ '취소|노게임|무효'
      and pr.favorite_team_code is not null
      and (g.home_team_code = pr.favorite_team_code or g.away_team_code = pr.favorite_team_code)
  ),
  agg as (
    select
      att.user_id,
      count(*)::int as games,
      count(*) filter (where att.winner_team_code = (select favorite_team_code from profiles where id = att.user_id))::int as wins,
      count(*) filter (
        where att.away_score = att.home_score
      )::int as draws
    from att
    group by att.user_id
  )
  select
    agg.user_id,
    coalesce(p.display_alias, p.display_name, '회원') as display_name,
    agg.games,
    agg.wins,
    (agg.games - agg.wins - agg.draws)::int as losses,
    agg.draws,
    case when agg.games = 0 then 0 else round((agg.wins::numeric / agg.games) * 100, 1) end as win_rate
  from agg
  join public.profiles p on p.id = agg.user_id
  order by win_rate desc, games desc, wins desc;
end;
$$;

create or replace function public.list_group_attendance_for_game(p_group_id uuid, p_game_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'not a member';
  end if;
  return query
  select ua.user_id, coalesce(p.display_alias, p.display_name, '회원')
  from public.user_attendance ua
  join public.group_members gm on gm.user_id = ua.user_id and gm.group_id = p_group_id
  left join public.profiles p on p.id = ua.user_id
  where ua.game_id = p_game_id;
end;
$$;

grant execute on function public.create_club_group(text) to authenticated;
grant execute on function public.join_club_group(text) to authenticated;
grant execute on function public.leave_club_group(uuid) to authenticated;
grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.list_group_members(uuid) to authenticated;
grant execute on function public.get_group_leaderboard(uuid) to authenticated;
grant execute on function public.list_group_attendance_for_game(uuid, uuid) to authenticated;
