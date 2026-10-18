create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  icon text not null default '📚',
  display_text text not null default '',
  subject_count integer not null default 0 check (subject_count >= 0),
  status text not null default 'active'
    check (status in ('active', 'coming_soon', 'hidden')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.semesters
  add column if not exists subject_count integer not null default 0
    check (subject_count >= 0);

alter table public.semesters enable row level security;
grant select on public.semesters to anon, authenticated;
grant insert, update, delete on public.semesters to authenticated;

drop policy if exists "Public can read visible semesters" on public.semesters;
create policy "Public can read visible semesters" on public.semesters
  for select to anon, authenticated
  using (status <> 'hidden' or public.is_library_admin());

drop policy if exists "Admins can manage semesters" on public.semesters;
create policy "Admins can manage semesters" on public.semesters
  for all to authenticated using (public.is_library_admin())
  with check (public.is_library_admin());

alter table public.categories
  add column if not exists description text not null default '',
  add column if not exists icon text not null default '📁',
  add column if not exists semester_id uuid references public.semesters(id) on delete set null;

insert into public.semesters
  (id, name, description, icon, display_text, status, subject_count, position)
values
  ('8c13f5b1-98bf-47a1-b076-ef58c0a10001', 'الترم الأول',
   'ملفات ومواد الترم الأول مرتبة في مكان واحد.', '📚', '', 'active', 6, 0),
  ('8c13f5b1-98bf-47a1-b076-ef58c0a10002', 'الترم الثاني',
   'نعمل على تجهيز محتوى الترم الثاني.', '🎓', 'قريبًا', 'coming_soon', 0, 1)
on conflict (id) do nothing;

update public.categories
set semester_id = '8c13f5b1-98bf-47a1-b076-ef58c0a10001'
where semester_id is null and parent_id is null;
