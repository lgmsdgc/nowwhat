-- Auth identity linking preserves the user ID. Existing-account merging is a
-- separate server-only, one-use proof flow. Local imports never award EXP.
alter table public.profiles add column merged_into uuid references public.profiles(id);
alter table public.recommendation_feedback alter constraint recommendation_feedback_session_id_user_id_fkey deferrable initially deferred;
create table public.account_migration_tickets (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  source_user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index migration_ticket_source on public.account_migration_tickets(source_user_id);
create table public.local_mission_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_anonymous_id uuid not null,
  source_session_id uuid not null,
  mission_id text not null references public.missions(id),
  title text not null,
  completed_at timestamptz not null,
  actual_duration_seconds integer not null check (actual_duration_seconds between 0 and 31536000),
  actual_cost integer check (actual_cost between 0 and 10000000),
  rating integer check (rating between 1 and 5),
  would_do_again boolean,
  comment text not null check (char_length(comment) <= 140),
  source text not null default 'local' check (source = 'local'),
  imported_at timestamptz not null default now(),
  unique(user_id,source_anonymous_id,source_session_id)
);
alter table public.account_migration_tickets enable row level security;
alter table public.local_mission_history enable row level security;
create policy local_history_owner_read on public.local_mission_history for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.account_migration_tickets,public.local_mission_history from public,anon,authenticated;
grant select on public.local_mission_history to authenticated;
grant all on public.account_migration_tickets,public.local_mission_history to service_role;

-- Keep the original reader, but deny the old anonymous account after a merge.
alter function public.get_game_state() rename to get_game_state_v1;
revoke all on function public.get_game_state_v1() from public,anon,authenticated;
create function public.get_game_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
  -- The v1 reader locks the profile for share. Check migration status after
  -- acquiring that lock, so a concurrent merge cannot slip past this check.
  snapshot:=public.get_game_state_v1();
  if exists(select 1 from public.profiles where id=auth.uid() and merged_into is not null) then
    raise exception 'Account already migrated' using errcode='42501';
  end if;
  return snapshot;
end;
$$;
revoke all on function public.get_game_state() from public,anon,authenticated;
grant execute on function public.get_game_state() to authenticated;

alter function public.commit_game_state(uuid,bigint,jsonb) rename to commit_game_state_v1;
revoke all on function public.commit_game_state_v1(uuid,bigint,jsonb) from public,anon,authenticated,service_role;
create function public.commit_game_state(p_user_id uuid,p_expected_revision bigint,p_state jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare destination uuid;
begin
  select merged_into into destination from public.profiles where id=p_user_id for update;
  if destination is not null then raise exception 'Account already migrated' using errcode='42501'; end if;
  perform public.commit_game_state_v1(p_user_id,p_expected_revision,p_state);
end;
$$;
revoke all on function public.commit_game_state(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.commit_game_state(uuid,bigint,jsonb) to service_role;

create function public.prepare_account_migration(p_source uuid,p_hash text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_source and merged_into is null for update;
  if not found or not exists(select 1 from auth.users where id=p_source and is_anonymous is true) then
    raise exception 'Anonymous owner required' using errcode='42501';
  end if;
  if (select count(*) from public.account_migration_tickets where source_user_id=p_source and claimed_at is null and expires_at>now())>=10 then
    raise exception 'Too many pending connections';
  end if;
  insert into public.account_migration_tickets(token_hash,source_user_id,expires_at) values(p_hash,p_source,now()+interval '24 hours');
end;
$$;
create function public.claim_account_migration(p_target uuid,p_hash text) returns integer
language plpgsql security definer set search_path='' as $$
declare ticket public.account_migration_tickets; src public.profiles; dst public.profiles;
  s public.mission_sessions; doc jsonb; gained integer; moved integer:=0; stamp text; feedback_id uuid;
begin
  select * into ticket from public.account_migration_tickets where token_hash=p_hash for update;
  if not found then raise exception 'Invalid migration proof' using errcode='42501'; end if;
  if ticket.claimed_by is not null then
    if ticket.claimed_by=p_target then return 0; end if;
    raise exception 'Proof already used' using errcode='42501';
  end if;
  if ticket.expires_at < now() or not exists(select 1 from auth.users where id=p_target and is_anonymous is false) then
    raise exception 'Verified member required or proof expired' using errcode='42501';
  end if;
  -- Lock both profiles in a stable order; all gameplay commits lock a profile.
  perform 1 from public.profiles where id in(ticket.source_user_id,p_target) order by id for update;
  select * into src from public.profiles where id=ticket.source_user_id;
  select * into dst from public.profiles where id=p_target;
  if src.merged_into=p_target then
    update public.account_migration_tickets set claimed_by=p_target,claimed_at=now() where token_hash=p_hash;
    return 0;
  end if;
  if dst.id is null or dst.merged_into is not null or src.merged_into is not null then
    raise exception 'Account unavailable' using errcode='42501';
  end if;
  if src.id=p_target then
    update public.account_migration_tickets set claimed_by=p_target,claimed_at=now() where token_hash=p_hash;
    return 0;
  end if;
  if not exists(select 1 from auth.users where id=src.id and is_anonymous is true) then
    raise exception 'Source must remain anonymous' using errcode='42501';
  end if;
  gained:=dst.exp;
  stamp:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for s in select * from public.mission_sessions where user_id=src.id order by position loop
    doc:=jsonb_set(s.document,'{anonymousId}',to_jsonb(dst.anonymous_id::text));
    if s.status in('recommended','started') and exists(select 1 from public.mission_sessions where user_id=p_target and status in('recommended','started')) then
      doc:=jsonb_set(doc,'{status}',to_jsonb(case when s.status='started' then 'abandoned'::text else 'rejected'::text end));
      if s.status='started' then doc:=jsonb_set(doc,'{abandonedAt}',to_jsonb(stamp)); end if;
      feedback_id:=gen_random_uuid();
      insert into public.recommendation_feedback(id,user_id,document,created_at) values(feedback_id,src.id,
        jsonb_build_object('id',feedback_id::text,'anonymousId',src.anonymous_id,'sessionId',s.id,'missionId',s.mission_id,'action',case when s.status='started' then 'abandoned' else 'rejected' end,'reason',null,'createdAt',stamp),now());
    end if;
    if s.status='completed' then
      doc:=jsonb_set(doc,'{result,expBefore}',to_jsonb(gained));
      gained:=gained+s.awarded_exp;
      doc:=jsonb_set(doc,'{result,expAfter}',to_jsonb(gained));
    end if;
    update public.mission_sessions set user_id=p_target,document=doc where id=s.id;
    moved:=moved+1;
  end loop;
  update public.recommendation_feedback set user_id=p_target,document=jsonb_set(document,'{anonymousId}',to_jsonb(dst.anonymous_id::text)) where user_id=src.id;
  insert into public.user_achievements(user_id,achievement_id,unlocked_at) select p_target,achievement_id,unlocked_at from public.user_achievements where user_id=src.id on conflict do nothing;
  delete from public.user_achievements where user_id=src.id;
  update public.local_mission_history set user_id=p_target where user_id=src.id;
  update public.profiles set exp=gained,revision=revision+1,updated_at=now() where id=p_target;
  update public.profiles set exp=0,merged_into=p_target,revision=revision+1,updated_at=now() where id=src.id;
  update public.account_migration_tickets set claimed_by=p_target,claimed_at=now() where token_hash=p_hash;
  return moved;
end;
$$;

create function public.import_local_history(p_target uuid,p_source uuid,p_records jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare item jsonb; mission_title text; added integer:=0; delta integer;
begin
  perform 1 from public.profiles where id=p_target and merged_into is null for update;
  if not found or not exists(select 1 from auth.users where id=p_target and is_anonymous is false) then
    raise exception 'Member required' using errcode='42501';
  end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records)>200 then raise exception 'Import too large'; end if;
  for item in select value from jsonb_array_elements(p_records) loop
    select title into mission_title from public.missions where id=item->>'mission_id';
    if not found then raise exception 'Unknown mission'; end if;
    insert into public.local_mission_history(user_id,source_anonymous_id,source_session_id,mission_id,title,completed_at,actual_duration_seconds,actual_cost,rating,would_do_again,comment)
    values(p_target,p_source,(item->>'source_session_id')::uuid,item->>'mission_id',mission_title,(item->>'completed_at')::timestamptz,(item->>'actual_duration_seconds')::integer,(item->>'actual_cost')::integer,(item->>'rating')::integer,(item->>'would_do_again')::boolean,item->>'comment')
    on conflict(user_id,source_anonymous_id,source_session_id) do nothing;
    get diagnostics delta=row_count;
    added:=added+delta;
  end loop;
  if (select count(*) from public.local_mission_history where user_id=p_target)>500 then raise exception 'Import limit exceeded'; end if;
  return added;
end;
$$;
revoke all on function public.prepare_account_migration(uuid,text),public.claim_account_migration(uuid,text),public.import_local_history(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_account_migration(uuid,text),public.claim_account_migration(uuid,text),public.import_local_history(uuid,uuid,jsonb) to service_role;
