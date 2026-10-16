-- Keep privileged implementations outside the exposed API schema.
alter function public.rls_is_teacher() set schema rls_private;
alter function public.rls_change_student(text,text,uuid,integer,text,bigint) set schema rls_private;
grant usage on schema rls_private to authenticated;
revoke all on function rls_private.rls_is_teacher() from public,anon,authenticated;
revoke all on function rls_private.rls_change_student(text,text,uuid,integer,text,bigint) from public,anon,authenticated;
grant execute on function rls_private.rls_is_teacher() to authenticated;
grant execute on function rls_private.rls_change_student(text,text,uuid,integer,text,bigint) to authenticated;
create function public.rls_is_teacher() returns boolean language sql stable security invoker set search_path='' as $$
  select rls_private.rls_is_teacher();
$$;
create function public.rls_change_student(
  p_class_id text,p_student_name text,p_request_id uuid,
  p_delta integer default null,p_remark text default null,p_expected_version bigint default null
) returns jsonb language sql security invoker set search_path='' as $$
  select rls_private.rls_change_student(p_class_id,p_student_name,p_request_id,p_delta,p_remark,p_expected_version);
$$;
revoke all on function public.rls_is_teacher() from public,anon,authenticated;
revoke all on function public.rls_change_student(text,text,uuid,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.rls_is_teacher() to authenticated;
grant execute on function public.rls_change_student(text,text,uuid,integer,text,bigint) to authenticated;
alter table rls_private.teacher_emails enable row level security;
