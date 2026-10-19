create table if not exists public.library_admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  target_type text not null check (
    target_type in ('categories', 'files', 'notifications', 'semesters')
  ),
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists library_admin_audit_created_idx
  on public.library_admin_audit_logs (created_at desc);

alter table public.library_admin_audit_logs enable row level security;
revoke all on public.library_admin_audit_logs from anon, authenticated;
grant select on public.library_admin_audit_logs to authenticated;

drop policy if exists "Admins can read library audit logs"
  on public.library_admin_audit_logs;
create policy "Admins can read library audit logs"
  on public.library_admin_audit_logs for select to authenticated
  using (public.is_library_admin());

create or replace function public.log_library_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb := '{}'::jsonb;
  new_record jsonb := '{}'::jsonb;
  record_id uuid;
begin
  if not public.is_library_admin() then
    raise exception 'غير مصرح';
  end if;

  if tg_op <> 'INSERT' then
    old_record := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_record := to_jsonb(new);
  end if;

  record_id := coalesce(new_record->>'id', old_record->>'id')::uuid;

  insert into public.library_admin_audit_logs
    (admin_id, action, target_type, target_id, details)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    record_id,
    jsonb_strip_nulls(jsonb_build_object(
      'result', 'success',
      'old_name', coalesce(
        old_record->>'name',
        old_record->>'name_ar',
        old_record->>'title'
      ),
      'new_name', coalesce(
        new_record->>'name',
        new_record->>'name_ar',
        new_record->>'title'
      )
    ))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.log_library_admin_change() from public, anon, authenticated;

drop trigger if exists categories_admin_audit on public.categories;
create trigger categories_admin_audit
  after insert or update or delete on public.categories
  for each row execute function public.log_library_admin_change();

drop trigger if exists files_admin_audit on public.files;
create trigger files_admin_audit
  after insert or update or delete on public.files
  for each row execute function public.log_library_admin_change();

drop trigger if exists notifications_admin_audit on public.notifications;
create trigger notifications_admin_audit
  after insert or update or delete on public.notifications
  for each row execute function public.log_library_admin_change();

drop trigger if exists semesters_admin_audit on public.semesters;
create trigger semesters_admin_audit
  after insert or update or delete on public.semesters
  for each row execute function public.log_library_admin_change();

notify pgrst, 'reload schema';
