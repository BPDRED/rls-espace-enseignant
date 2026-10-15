-- Supabase grants new functions to anon explicitly as well as PUBLIC.
revoke all on function public.rls_is_teacher() from public,anon,authenticated;
grant execute on function public.rls_is_teacher() to authenticated;
revoke all on function public.rls_change_student(text,text,uuid,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.rls_change_student(text,text,uuid,integer,text,bigint) to authenticated;

create schema rls_private;
revoke all on schema rls_private from public,anon,authenticated;
create table rls_private.teacher_emails(email text primary key check(email=lower(email)));
revoke all on rls_private.teacher_emails from public,anon,authenticated;
create function rls_private.refresh_teacher() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  if new.email_confirmed_at is not null and exists(select 1 from rls_private.teacher_emails where email=lower(new.email)) then
    insert into public.rls_teachers(user_id) values(new.id) on conflict do nothing;
  else
    delete from public.rls_teachers where user_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function rls_private.refresh_teacher() from public,anon,authenticated;
create trigger rls_teacher_verified after insert or update of email,email_confirmed_at on auth.users
  for each row execute function rls_private.refresh_teacher();
