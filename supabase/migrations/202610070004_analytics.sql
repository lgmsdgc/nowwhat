-- Behavioral events only. No comments, costs, ratings, email or full URLs.
create table public.analytics_events (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  anonymous_id uuid not null,
  name text not null check(name in ('visit_started','landing_view','onboarding_started','onboarding_completed','mission_requested','mission_shown','mission_rejected','mission_accepted','mission_started','mission_completed','mission_abandoned','mission_share_requested','mission_shared')),
  visit_id uuid not null,
  session_id uuid,
  recommendation_run_id uuid,
  mission_id text references public.missions(id),
  source text not null check(source in ('client','game')),
  dedupe_key text not null check(char_length(dedupe_key) between 1 and 160),
  occurred_at timestamptz not null,
  local_date date not null,
  time_zone text not null check(char_length(time_zone) between 1 and 100),
  properties jsonb not null default '{}' check(jsonb_typeof(properties)='object' and properties-array['requestKind','channel','rerollIndex','reason']::text[]='{}'::jsonb),
  received_at timestamptz not null default now(),
  unique(user_id,dedupe_key),
  foreign key(session_id,user_id) references public.mission_sessions(id,user_id) deferrable initially deferred
);
create index analytics_owner_time on public.analytics_events(user_id,occurred_at);
create index analytics_name_date on public.analytics_events(name,local_date);
create index analytics_session on public.analytics_events(session_id) where session_id is not null;
alter table public.analytics_events enable row level security;
create policy analytics_owner_read on public.analytics_events for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.analytics_events from public,anon,authenticated;
grant select on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;

-- Preserve the tested gameplay RPC; optional context changes no game rules.
alter function public.commit_game_state(uuid,bigint,jsonb) rename to commit_game_state_v2;
revoke all on function public.commit_game_state_v2(uuid,bigint,jsonb) from public,anon,authenticated,service_role;
create function public.commit_game_state(p_user_id uuid,p_expected_revision bigint,p_state jsonb,p_analytics_context jsonb default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_analytics_context is not null then
    if jsonb_typeof(p_analytics_context) <> 'object'
      or p_analytics_context-array['visitId','timeZone']::text[] <> '{}'::jsonb
      or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_analytics_context->>'timeZone')
      or p_analytics_context->>'visitId' is null then
      raise exception 'Invalid analytics context';
    end if;
    perform (p_analytics_context->>'visitId')::uuid;
  end if;
  perform pg_catalog.set_config('nowwhat.analytics_context',coalesce(p_analytics_context::text,''),true);
  perform public.commit_game_state_v2(p_user_id,p_expected_revision,p_state);
end;
$$;
revoke all on function public.commit_game_state(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_game_state(uuid,bigint,jsonb,jsonb) to service_role;

create function public.emit_game_analytics(p_session public.mission_sessions,p_name text,p_stamp timestamptz,p_context jsonb,p_properties jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into public.analytics_events(id,user_id,anonymous_id,name,visit_id,session_id,recommendation_run_id,mission_id,source,dedupe_key,occurred_at,local_date,time_zone,properties)
    values(gen_random_uuid(),p_session.user_id,p_session.anonymous_id,p_name,(p_context->>'visitId')::uuid,p_session.id,p_session.recommendation_run_id,p_session.mission_id,'game',
      'session:'||p_session.id::text||':'||p_name,p_stamp,(p_stamp at time zone (p_context->>'timeZone'))::date,p_context->>'timeZone',p_properties)
    on conflict(user_id,dedupe_key) do nothing;
end;
$$;
revoke all on function public.emit_game_analytics(public.mission_sessions,text,timestamptz,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.on_session_analytics() returns trigger
language plpgsql security definer set search_path='' as $$
declare context jsonb; props jsonb; stamp timestamptz; reason text;
begin
  context:=nullif(pg_catalog.current_setting('nowwhat.analytics_context',true),'')::jsonb;
  if context is null then return new; end if;
  props:=jsonb_build_object('rerollIndex',new.reroll_index);
  if tg_op='INSERT' then perform public.emit_game_analytics(new,'mission_shown',new.shown_at,context,props); end if;
  if tg_op='UPDATE' and new.status=old.status then return new; end if;
  if new.status='started' then
    perform public.emit_game_analytics(new,'mission_accepted',new.accepted_at,context,props);
    perform public.emit_game_analytics(new,'mission_started',new.started_at,context,props);
  elsif new.status='completed' then perform public.emit_game_analytics(new,'mission_completed',new.completed_at,context,props);
  elsif new.status='abandoned' then perform public.emit_game_analytics(new,'mission_abandoned',(new.document->>'abandonedAt')::timestamptz,context,props);
  -- Rejection reason is inserted as feedback later in the same commit.
  end if;
  return new;
exception when others then
  -- An analytics-only failure must not roll back an otherwise valid game.
  raise warning 'Game analytics capture failed (%).',sqlstate;
  return new;
end;
$$;
revoke all on function public.on_session_analytics() from public,anon,authenticated,service_role;
create trigger session_analytics after insert or update of document on public.mission_sessions
  for each row execute function public.on_session_analytics();
create function public.on_rejection_analytics() returns trigger
language plpgsql security definer set search_path='' as $$
declare context jsonb; session public.mission_sessions;
begin
  if new.action <> 'rejected' then return new; end if;
  context:=nullif(pg_catalog.current_setting('nowwhat.analytics_context',true),'')::jsonb;
  if context is null then return new; end if;
  select * into session from public.mission_sessions where id=new.session_id and user_id=new.user_id;
  perform public.emit_game_analytics(session,'mission_rejected',new.created_at,context,jsonb_build_object('rerollIndex',session.reroll_index,'reason',new.reason));
  return new;
exception when others then raise warning 'Rejection analytics capture failed (%).',sqlstate; return new;
end;
$$;
revoke all on function public.on_rejection_analytics() from public,anon,authenticated,service_role;
create trigger rejection_analytics after insert on public.recommendation_feedback
  for each row execute function public.on_rejection_analytics();

-- The browser can report visits/intents/shares, never claim a game lifecycle fact.
create function public.record_client_events(p_user_id uuid,p_anonymous_id uuid,p_events jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare p public.profiles; item jsonb; s public.mission_sessions; event_name text; event_id uuid;
  visit uuid; stamp timestamptz; zone text; props jsonb; key text; added integer:=0; delta integer;
begin
  select * into p from public.profiles where id=p_user_id for share;
  if not found or p.merged_into is not null or p.anonymous_id <> p_anonymous_id then raise exception 'Invalid event owner' using errcode='42501'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 20 then raise exception 'Invalid event batch'; end if;
  for item in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(item) is distinct from 'object' or item-array['id','name','visitId','timeZone','occurredAt','sessionId','properties']::text[] <> '{}'::jsonb then raise exception 'Unexpected event fields'; end if;
    event_name:=item->>'name'; event_id:=(item->>'id')::uuid; visit:=(item->>'visitId')::uuid;
    zone:=item->>'timeZone'; stamp:=(item->>'occurredAt')::timestamptz; props:=item->'properties';
    if event_name is null or event_name not in ('visit_started','landing_view','onboarding_started','onboarding_completed','mission_requested','mission_share_requested','mission_shared') then raise exception 'Client lifecycle facts forbidden' using errcode='42501'; end if;
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) or stamp is null or stamp < now()-interval '7 days' or stamp > now()+interval '5 minutes' then raise exception 'Invalid event time'; end if;
    if jsonb_typeof(props) is distinct from 'object' then raise exception 'Invalid properties'; end if;
    if event_name='mission_requested' then
      if props-array['requestKind']::text[] <> '{}'::jsonb or (props->>'requestKind') is null or props->>'requestKind' not in ('onboarding','repeat','reroll') then raise exception 'Invalid request kind'; end if;
    elsif event_name in('mission_share_requested','mission_shared') then
      if props-array['channel']::text[] <> '{}'::jsonb or (props->>'channel') is null or props->>'channel' not in ('native','clipboard') then raise exception 'Invalid share channel'; end if;
    elsif props <> '{}'::jsonb then raise exception 'Unexpected properties'; end if;
    s:=null;
    if item->>'sessionId' is not null then
      if event_name not in ('mission_requested','mission_share_requested','mission_shared') then raise exception 'Unexpected session'; end if;
      select * into s from public.mission_sessions where id=(item->>'sessionId')::uuid and user_id=p_user_id;
      if not found then raise exception 'Invalid session owner' using errcode='42501'; end if;
    end if;
    if event_name in('mission_share_requested','mission_shared') and (s.id is null or s.status <> 'completed') then raise exception 'Completed session required'; end if;
    key:=case when event_name in ('visit_started','landing_view','onboarding_started','onboarding_completed') then 'visit:'||visit::text||':'||event_name else 'event:'||event_id::text||':'||event_name end;
    insert into public.analytics_events(id,user_id,anonymous_id,name,visit_id,session_id,recommendation_run_id,mission_id,source,dedupe_key,occurred_at,local_date,time_zone,properties)
      values(event_id,p_user_id,p_anonymous_id,event_name,visit,s.id,s.recommendation_run_id,s.mission_id,'client',key,stamp,(stamp at time zone zone)::date,zone,props)
      on conflict(user_id,dedupe_key) do nothing;
    get diagnostics delta=row_count; added:=added+delta;
  end loop;
  return added;
end;
$$;
revoke all on function public.record_client_events(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_client_events(uuid,uuid,jsonb) to service_role;

-- Stitch anonymous history into the member; shared per-tab visit keys can overlap.
alter function public.claim_account_migration(uuid,text) rename to claim_account_migration_v1;
revoke all on function public.claim_account_migration_v1(uuid,text) from public,anon,authenticated,service_role;
create function public.claim_account_migration(p_target uuid,p_hash text) returns integer
language plpgsql security definer set search_path='' as $$
declare source_owner uuid; moved integer;
begin
  moved:=public.claim_account_migration_v1(p_target,p_hash);
  select source_user_id into source_owner from public.account_migration_tickets where token_hash=p_hash;
  if source_owner <> p_target then
    update public.analytics_events dst set anonymous_id=src.anonymous_id,occurred_at=src.occurred_at,local_date=src.local_date,time_zone=src.time_zone,properties=src.properties
      from public.analytics_events src where src.user_id=source_owner and dst.user_id=p_target and src.dedupe_key=dst.dedupe_key and src.occurred_at < dst.occurred_at;
    delete from public.analytics_events src using public.analytics_events dst where src.user_id=source_owner and dst.user_id=p_target and src.dedupe_key=dst.dedupe_key;
    update public.analytics_events set user_id=p_target where user_id=source_owner;
  end if;
  return moved;
end;
$$;
revoke all on function public.claim_account_migration(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_account_migration(uuid,text) to service_role;
