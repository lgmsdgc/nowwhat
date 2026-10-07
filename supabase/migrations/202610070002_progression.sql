-- Award definitions are public; earned titles remain private and server-written.
alter table public.achievements add column emoji text not null default '🏅' check(char_length(emoji) between 1 and 16);
alter table public.achievements add constraint achievement_rule_type check(condition_type in ('completed_count','distinct_categories'));
alter table public.achievements add constraint achievement_rule_value check(
  jsonb_typeof(condition_value)='object'
  and condition_value ? 'target' and condition_value ? 'filter'
  and jsonb_typeof(condition_value->'target')='number'
  and (condition_value->>'target')::numeric between 1 and 10000
  and (condition_value->>'target')::numeric=trunc((condition_value->>'target')::numeric)
  and jsonb_typeof(condition_value->'filter')='object'
  and condition_value - array['target','filter']::text[]='{}'::jsonb
  and (condition_value->'filter') - array['category','relationship','outdoor','zeroCost']::text[]='{}'::jsonb
  and (not (condition_value->'filter') ? 'category' or (jsonb_typeof(condition_value#>'{filter,category}')='string' and (condition_value#>>'{filter,category}') in ('food','walk','game','conversation','challenge','exploration','home','creative','photo','shopping','random','date')))
  and (not (condition_value->'filter') ? 'relationship' or (jsonb_typeof(condition_value#>'{filter,relationship}')='string' and (condition_value#>>'{filter,relationship}') in ('solo','friend','couple','family')))
  and (not (condition_value->'filter') ? 'outdoor' or jsonb_typeof(condition_value#>'{filter,outdoor}')='boolean')
  and (not (condition_value->'filter') ? 'zeroCost' or jsonb_typeof(condition_value#>'{filter,zeroCost}')='boolean')
);
alter table public.user_achievements add column earned_session_id uuid references public.mission_sessions(id) on delete set null;

create function public.award_achievements(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.achievements; s public.mission_sessions; rules jsonb;
  progress integer; categories text[]; category text;
begin
  -- Serializes completions for this owner and shares the gameplay transaction.
  perform 1 from public.profiles where id=p_user_id and merged_into is null for update;
  if not found then return; end if;
  for a in select * from public.achievements where active order by id loop
    rules:=a.condition_value->'filter';
    progress:=0; categories:=array[]::text[];
    for s in select * from public.mission_sessions where user_id=p_user_id and status='completed' order by completed_at,id loop
      if rules ? 'category' and s.document#>>'{mission,category}' <> rules->>'category' then continue; end if;
      if rules ? 'relationship' and s.document#>>'{answers,relationship}' <> rules->>'relationship' then continue; end if;
      if rules ? 'outdoor' and s.document#>'{mission,outdoor}' <> rules->'outdoor' then continue; end if;
      -- Missing costs are not 0. No budget inference is used for this award.
      if rules->'zeroCost'='true'::jsonb and (s.actual_cost is null or s.actual_cost <> 0) then continue; end if;
      category:=s.document#>>'{mission,category}';
      if a.condition_type='distinct_categories' then
        if not(category=any(categories)) then categories:=array_append(categories,category); end if;
        progress:=cardinality(categories);
      else progress:=progress+1;
      end if;
      if progress >= (a.condition_value->>'target')::numeric then
        insert into public.user_achievements(user_id,achievement_id,unlocked_at,earned_session_id)
          values(p_user_id,a.id,s.completed_at,s.id)
          on conflict(user_id,achievement_id) do update
          set unlocked_at=excluded.unlocked_at,earned_session_id=excluded.earned_session_id
          where excluded.unlocked_at < user_achievements.unlocked_at
            or (excluded.unlocked_at=user_achievements.unlocked_at
              and (user_achievements.earned_session_id is null or excluded.earned_session_id < user_achievements.earned_session_id));
        exit;
      end if;
    end loop;
  end loop;
end;
$$;
revoke all on function public.award_achievements(uuid) from public,anon,authenticated,service_role;

create function public.on_session_achievement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='completed' then perform public.award_achievements(new.user_id); end if;
  return new;
end;
$$;
revoke all on function public.on_session_achievement() from public,anon,authenticated,service_role;
create trigger session_achievement_award after insert or update of document,user_id
  on public.mission_sessions for each row execute function public.on_session_achievement();
