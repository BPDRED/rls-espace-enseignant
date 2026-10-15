create table public.rls_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.rls_teachers enable row level security;
revoke all on public.rls_teachers from anon, authenticated;

create function public.rls_is_teacher() returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.rls_teachers where user_id = auth.uid());
$$;
revoke all on function public.rls_is_teacher() from public,anon,authenticated;
grant execute on function public.rls_is_teacher() to authenticated;

create table public.rls_student_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  class_id text not null check(class_id in ('math-3aep','math-4aep','svt-4aep','svt-5aep','svt-6aep')),
  student_name text not null check(length(student_name) between 1 and 160),
  points integer not null default 0 check(points between -100000 and 100000),
  remark text not null default '' check(length(remark) <= 4000),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(owner_id,class_id,student_name)
);
create table public.rls_student_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  class_id text not null,
  student_name text not null,
  kind text not null check(kind in ('point','remark')),
  delta integer,
  previous_points integer not null,
  points integer not null,
  previous_remark text not null,
  remark text not null,
  version bigint not null,
  created_at timestamptz not null default now(),
  unique(owner_id,request_id)
);
create index rls_events_owner_date on public.rls_student_events(owner_id,created_at desc,id desc);
alter table public.rls_student_records enable row level security;
alter table public.rls_student_events enable row level security;
create policy teacher_records_read on public.rls_student_records for select to authenticated
  using(owner_id = (select auth.uid()) and (select public.rls_is_teacher()));
create policy teacher_events_read on public.rls_student_events for select to authenticated
  using(owner_id = (select auth.uid()) and (select public.rls_is_teacher()));
revoke all on public.rls_student_records, public.rls_student_events from anon,authenticated;
grant select on public.rls_student_records, public.rls_student_events to authenticated;

-- Mutations and their audit entry commit together. The caller cannot choose an owner.
create function public.rls_change_student(
  p_class_id text, p_student_name text, p_request_id uuid,
  p_delta integer default null, p_remark text default null,
  p_expected_version bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  who uuid := auth.uid();
  old public.rls_student_records;
  result public.rls_student_records;
  event public.rls_student_events;
begin
  if who is null or not public.rls_is_teacher() then
    raise exception 'Accès refusé' using errcode='42501';
  end if;
  if p_request_id is null or (p_delta is null) = (p_remark is null)
    or (p_delta is not null and p_delta not in (-1,1))
    or (p_remark is not null and (length(p_remark)>4000 or p_expected_version is null)) then
    raise exception 'Modification invalide' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text || p_request_id::text,0));
  select * into event from public.rls_student_events where owner_id=who and request_id=p_request_id;
  if found then
    if event.class_id <> p_class_id or event.student_name <> p_student_name
      or event.delta is distinct from p_delta
      or (p_remark is not null and event.remark <> p_remark) then
      raise exception 'Identifiant déjà utilisé' using errcode='22023';
    end if;
    select * into result from public.rls_student_records
      where owner_id=who and class_id=p_class_id and student_name=p_student_name;
    return to_jsonb(result);
  end if;
  insert into public.rls_student_records(owner_id,class_id,student_name)
    values(who,p_class_id,p_student_name) on conflict do nothing;
  select * into old from public.rls_student_records
    where owner_id=who and class_id=p_class_id and student_name=p_student_name for update;
  if p_remark is not null and old.version <> p_expected_version then
    raise exception 'Cette fiche a changé sur un autre appareil. Actualisez avant de remplacer la remarque.' using errcode='40001';
  end if;
  update public.rls_student_records set points=old.points+coalesce(p_delta,0),
    remark=coalesce(p_remark,old.remark), version=old.version+1, updated_at=now()
    where owner_id=who and class_id=p_class_id and student_name=p_student_name returning * into result;
  insert into public.rls_student_events(owner_id,request_id,class_id,student_name,kind,delta,
      previous_points,points,previous_remark,remark,version)
    values(who,p_request_id,p_class_id,p_student_name,case when p_delta is null then 'remark' else 'point' end,
      p_delta,old.points,result.points,old.remark,result.remark,result.version);
  return to_jsonb(result);
end;
$$;
revoke all on function public.rls_change_student(text,text,uuid,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.rls_change_student(text,text,uuid,integer,text,bigint) to authenticated;
