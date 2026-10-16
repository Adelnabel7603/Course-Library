create table if not exists public.homepage_sections (
  id text primary key check (id in ('personal', 'discovery', 'planner', 'library')),
  position integer not null default 0 check (position >= 0),
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists homepage_sections_position_idx
  on public.homepage_sections (position);

alter table public.homepage_sections enable row level security;

grant select on public.homepage_sections to anon, authenticated;
grant insert, update, delete on public.homepage_sections to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'homepage_sections'
      and policyname = 'Public can read visible homepage sections'
  ) then
    create policy "Public can read visible homepage sections" on public.homepage_sections
      for select to anon, authenticated
      using (is_visible or public.is_library_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'homepage_sections'
      and policyname = 'Admins can manage homepage sections'
  ) then
    create policy "Admins can manage homepage sections" on public.homepage_sections
      for all to authenticated
      using (public.is_library_admin())
      with check (public.is_library_admin());
  end if;
end
$$;

insert into public.homepage_sections (id, position, is_visible)
values
  ('personal', 0, true),
  ('discovery', 1, true),
  ('planner', 2, true),
  ('library', 3, true)
on conflict (id) do nothing;