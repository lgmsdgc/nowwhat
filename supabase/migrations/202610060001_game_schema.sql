-- Reviewed templates and immutable session snapshots share the v1 domain format.
-- Generated columns expose queryable fields without two writable sources of truth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  anonymous_id uuid not null unique default gen_random_uuid(),
  nickname text check (char_length(nickname) between 1 and 30),
  exp integer not null default 0 check (exp >= 0),
  level integer generated always as (exp / 300 + 1) stored,
  revision bigint not null default 0 check (revision >= 0),
  onboarding jsonb not null default '{"answers":{},"step":0}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missions (
  id text primary key check (char_length(id) between 1 and 80),
  template jsonb not null check (jsonb_typeof(template) = 'object' and template->>'id' = id and template->>'version' = '1'),
  title text generated always as (template->>'title') stored not null,
  short_description text generated always as (template->>'shortDescription') stored not null,
  description text generated always as (template->>'fullDescription') stored not null,
  category text generated always as (template->>'category') stored not null,
  min_people integer generated always as ((template->>'minPeople')::integer) stored not null check (min_people >= 1),
  max_people integer generated always as ((template->>'maxPeople')::integer) stored check (max_people >= min_people),
  min_budget integer generated always as ((template->>'minBudget')::integer) stored not null check (min_budget >= 0),
  max_budget integer generated always as ((template->>'maxBudget')::integer) stored not null check (max_budget >= min_budget),
  min_duration integer generated always as ((template->>'minDuration')::integer) stored not null check (min_duration > 0),
  max_duration integer generated always as ((template->>'maxDuration')::integer) stored not null check (max_duration >= min_duration),
  energy_level integer generated always as ((template->>'energyLevel')::integer) stored not null check (energy_level between 1 and 4),
  intensity integer generated always as ((template->>'intensity')::integer) stored not null check (intensity between 1 and 4),
  travel_scope text generated always as (template->>'travelScope') stored not null check (travel_scope in ('home','nearby','far','anywhere')),
  indoor boolean generated always as ((template->>'indoor')::boolean) stored not null,
  outdoor boolean generated always as ((template->>'outdoor')::boolean) stored not null,
  night_safe boolean generated always as ((template->>'nightSafe')::boolean) stored not null,
  solo_safe boolean generated always as ((template->>'soloSafe')::boolean) stored not null,
  family_safe boolean generated always as ((template->>'familySafe')::boolean) stored not null,
  minor_safe boolean generated always as ((template->>'minorSafe')::boolean) stored not null,
  requires_car boolean generated always as ((template->>'requiresCar')::boolean) stored not null,
  alcohol_related boolean generated always as ((template->>'alcoholRelated')::boolean) stored not null,
  physical_risk_level integer generated always as ((template->>'physicalRiskLevel')::integer) stored not null check (physical_risk_level between 0 and 3),
  physical_intensity integer generated always as ((template->>'physicalIntensity')::integer) stored not null check (physical_intensity between 1 and 4),
  location_required boolean generated always as ((template->>'locationRequired')::boolean) stored not null,
  base_exp integer generated always as ((template->>'baseExp')::integer) stored not null check (base_exp between 0 and 1000),
  active boolean generated always as ((template->>'active')::boolean) stored not null,
  created_at timestamptz not null default now()
);
create index missions_active_category on public.missions(category) where active;
create table public.mission_relationships (
  mission_id text not null references public.missions(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('solo','friend','couple','family')),
  primary key (mission_id, relationship_type)
);

-- Supabase anonymous Auth users also have auth.users IDs. Ownership always uses
-- user_id, never the browser-supplied anonymous_id (which is only an audit ID).
create table public.mission_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object' and (document->>'id')::uuid = id),
  anonymous_id uuid generated always as ((document->>'anonymousId')::uuid) stored not null,
  mission_id text generated always as (document->'mission'->>'id') stored not null references public.missions(id),
  recommendation_run_id uuid generated always as ((document->>'recommendationRunId')::uuid) stored not null,
  reroll_index integer generated always as ((document->>'rerollIndex')::integer) stored not null check (reroll_index >= 0),
  status text generated always as (document->>'status') stored not null check (status in ('recommended','started','completed','rejected','abandoned')),
  shown_at timestamptz not null,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  actual_cost integer generated always as ((document->'result'->>'actualCost')::integer) stored check (actual_cost between 0 and 10000000),
  rating integer generated always as ((document->'result'->>'rating')::integer) stored check (rating between 1 and 5),
  comment text generated always as (document->'result'->>'comment') stored check (char_length(comment) <= 140),
  awarded_exp integer generated always as ((document->'result'->>'awardedExp')::integer) stored check (awarded_exp between 0 and 1000),
  position bigint generated always as identity,
  unique (id, user_id),
  unique (user_id, recommendation_run_id, reroll_index),
  check (status not in ('started','completed','abandoned') or started_at is not null),
  check ((status = 'completed') = (document->'result' <> 'null'::jsonb)),
  check (status <> 'completed' or (completed_at is not null and awarded_exp = (document->'mission'->>'baseExp')::integer))
);
create unique index one_active_mission_per_user on public.mission_sessions(user_id) where status in ('recommended','started');
create index mission_sessions_user_position on public.mission_sessions(user_id, position);

create table public.recommendation_feedback (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object' and (document->>'id')::uuid = id),
  anonymous_id uuid generated always as ((document->>'anonymousId')::uuid) stored not null,
  session_id uuid generated always as ((document->>'sessionId')::uuid) stored not null,
  mission_id text generated always as (document->>'missionId') stored not null references public.missions(id),
  action text generated always as (document->>'action') stored not null check (action in ('shown','accepted','rejected','completed','abandoned','liked','disliked')),
  reason text generated always as (document->>'reason') stored check (reason in ('expensive','low_energy','too_far','not_fun','not_for_me')),
  created_at timestamptz not null,
  position bigint generated always as identity,
  foreign key (session_id, user_id) references public.mission_sessions(id, user_id) on delete cascade,
  unique (session_id, action)
);
create index feedback_user_position on public.recommendation_feedback(user_id, position);
create table public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  condition_type text not null,
  condition_value jsonb not null,
  active boolean not null default true
);
create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.mission_relationships enable row level security;
alter table public.mission_sessions enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
create policy profile_owner_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy session_owner_read on public.mission_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy feedback_owner_read on public.recommendation_feedback for select to authenticated using (user_id = (select auth.uid()));
create policy achievement_owner_read on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));
create policy active_missions_read on public.missions for select to anon, authenticated using (active);
create policy active_relationships_read on public.mission_relationships for select to anon, authenticated using (exists (select 1 from public.missions m where m.id = mission_id and m.active));
create policy active_achievements_read on public.achievements for select to anon, authenticated using (active);
revoke all on public.profiles, public.missions, public.mission_relationships, public.mission_sessions, public.recommendation_feedback, public.achievements, public.user_achievements from public, anon, authenticated;
grant select on public.missions, public.mission_relationships, public.achievements to anon, authenticated;
grant select on public.profiles, public.mission_sessions, public.recommendation_feedback, public.user_achievements to authenticated;
grant all on public.profiles, public.missions, public.mission_relationships, public.mission_sessions, public.recommendation_feedback, public.achievements, public.user_achievements to service_role;
grant usage, select on sequence public.mission_sessions_position_seq, public.recommendation_feedback_position_seq to service_role;

create function public.get_game_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); p public.profiles; result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.profiles(id) values(owner_id) on conflict (id) do nothing;
  select * into p from public.profiles where id = owner_id for share;
  select jsonb_build_object('revision', p.revision, 'state', jsonb_build_object(
    'version', 1, 'anonymousId', p.anonymous_id,
    'createdAt', to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'onboarding', p.onboarding,
    'sessions', coalesce((select jsonb_agg(s.document order by s.position) from public.mission_sessions s where s.user_id = owner_id), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(f.document order by f.position) from public.recommendation_feedback f where f.user_id = owner_id), '[]'::jsonb)
  )) into result;
  return result;
end;
$$;

-- Only the trusted Next.js server can call this function. Browser clients cannot
-- submit arbitrary state, timestamps, ownership, or EXP.
create function public.commit_game_state(p_user_id uuid, p_expected_revision bigint, p_state jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; item jsonb; old public.mission_sessions; prior jsonb;
begin
  select * into p from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile missing' using errcode = '42501'; end if;
  if p.revision <> p_expected_revision then raise exception 'Revision conflict' using errcode = '40001'; end if;
  if p_state->>'version' <> '1' or (p_state->>'anonymousId')::uuid is distinct from p.anonymous_id
    or (p_state->>'createdAt')::timestamptz is distinct from date_trunc('milliseconds', p.created_at)
    or jsonb_typeof(p_state->'sessions') is distinct from 'array'
    or jsonb_typeof(p_state->'feedback') is distinct from 'array'
  then raise exception 'Invalid state identity' using errcode = '42501'; end if;
  if exists (select 1 from public.mission_sessions s where s.user_id = p_user_id and not exists (
    select 1 from jsonb_array_elements(p_state->'sessions') n where (n->>'id')::uuid = s.id
  )) or exists (select 1 from public.recommendation_feedback f where f.user_id = p_user_id and not exists (
    select 1 from jsonb_array_elements(p_state->'feedback') n where (n->>'id')::uuid = f.id
  )) then raise exception 'History cannot be removed' using errcode = '42501'; end if;

  -- Array order is the original creation order: reject/complete before inserting
  -- the next active session, so the partial unique index remains valid.
  for item in select value from jsonb_array_elements(p_state->'sessions') loop
    if (item->>'anonymousId')::uuid is distinct from p.anonymous_id then raise exception 'Invalid owner' using errcode = '42501'; end if;
    select * into old from public.mission_sessions where id = (item->>'id')::uuid;
    if found then
      if old.user_id <> p_user_id or old.document->'mission' <> item->'mission'
        or old.document->'answers' <> item->'answers'
        or (old.status in ('completed','rejected','abandoned') and old.document <> item)
      then raise exception 'Immutable history' using errcode = '42501'; end if;
      update public.mission_sessions set document = item,
        shown_at = (item->>'shownAt')::timestamptz, accepted_at = (item->>'acceptedAt')::timestamptz,
        started_at = (item->>'startedAt')::timestamptz, completed_at = (item->>'completedAt')::timestamptz
        where id = old.id and document is distinct from item;
    else
      insert into public.mission_sessions(id,user_id,document,shown_at,accepted_at,started_at,completed_at)
        values((item->>'id')::uuid,p_user_id,item,(item->>'shownAt')::timestamptz,(item->>'acceptedAt')::timestamptz,(item->>'startedAt')::timestamptz,(item->>'completedAt')::timestamptz);
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_state->'feedback') loop
    if (item->>'anonymousId')::uuid is distinct from p.anonymous_id or not exists (
      select 1 from public.mission_sessions s where s.id = (item->>'sessionId')::uuid and s.user_id = p_user_id and s.mission_id = item->>'missionId'
    ) then raise exception 'Invalid feedback owner' using errcode = '42501'; end if;
    select document into prior from public.recommendation_feedback where id = (item->>'id')::uuid;
    if found then
      if prior is distinct from item then raise exception 'Immutable feedback' using errcode = '42501'; end if;
    else
      insert into public.recommendation_feedback(id,user_id,document,created_at) values((item->>'id')::uuid,p_user_id,item,(item->>'createdAt')::timestamptz);
    end if;
  end loop;
  update public.profiles set onboarding = p_state->'onboarding',
    exp = coalesce((select sum(awarded_exp) from public.mission_sessions where user_id = p_user_id and status = 'completed'),0),
    revision = revision + 1, updated_at = now() where id = p_user_id;
end;
$$;
revoke all on function public.get_game_state() from public, anon, authenticated;
grant execute on function public.get_game_state() to authenticated;
revoke all on function public.commit_game_state(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.commit_game_state(uuid,bigint,jsonb) to service_role;
