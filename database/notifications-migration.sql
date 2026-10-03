alter table public.categories
  add column if not exists parent_id uuid
  references public.categories(id) on delete set null;

create index if not exists categories_parent_position_idx
  on public.categories (parent_id, position);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  type text not null default 'announcement'
    check (type in ('file', 'announcement')),
  file_id uuid references public.files(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists notifications_active_created_idx
  on public.notifications (is_active, created_at desc);

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%'),
  p256dh text not null,
  auth_secret text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.notifications to anon;
revoke all on public.push_subscriptions from anon, authenticated;

drop policy if exists "Public can read active notifications" on public.notifications;
create policy "Public can read active notifications" on public.notifications
  for select to anon, authenticated using (is_active);

drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications" on public.notifications
  for all to authenticated using (public.is_library_admin())
  with check (public.is_library_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
