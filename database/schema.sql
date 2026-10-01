create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null unique check (length(trim(name_ar)) > 0),
  name_en text not null default '',
  is_active boolean not null default true,
  is_coming_soon boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  category_id uuid not null references public.categories(id) on delete restrict,
  object_path text not null unique,
  cover_path text,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  position integer not null default 0,
  downloads bigint not null default 0 check (downloads >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_category_position_idx
  on public.files (category_id, position, created_at desc);
create index if not exists files_publication_idx on public.files (is_published);

create or replace function public.set_file_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists files_set_updated_at on public.files;
create trigger files_set_updated_at
before update on public.files
for each row execute function public.set_file_updated_at();

create or replace function public.is_library_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

create or replace function public.increment_file_downloads(file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.files
     set downloads = downloads + 1
   where id = file_id and is_published = true;
end;
$$;

revoke all on function public.increment_file_downloads(uuid) from public;
grant execute on function public.increment_file_downloads(uuid) to anon, authenticated;
revoke all on function public.is_library_admin() from public;
grant execute on function public.is_library_admin() to anon, authenticated;

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.files enable row level security;

grant select on public.admins to authenticated;
grant select, insert, update, delete on public.categories, public.files to authenticated;
grant select on public.categories, public.files to anon;

drop policy if exists "Admins can read their own record" on public.admins;
create policy "Admins can read their own record" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories" on public.categories
  for select to anon, authenticated using (is_active or public.is_library_admin());
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories
  for all to authenticated using (public.is_library_admin())
  with check (public.is_library_admin());

drop policy if exists "Public can read published files" on public.files;
create policy "Public can read published files" on public.files
  for select to anon, authenticated using (is_published or public.is_library_admin());
drop policy if exists "Admins can manage files" on public.files;
create policy "Admins can manage files" on public.files
  for all to authenticated using (public.is_library_admin())
  with check (public.is_library_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-files',
  'library-files',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
        'text/plain']
)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read library files" on storage.objects;
drop policy if exists "Public can read published assets" on storage.objects;
create policy "Public can read published assets" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'library-files'
    and (
      public.is_library_admin()
      or exists (
        select 1 from public.files
        where is_published = true
          and (object_path = storage.objects.name or cover_path = storage.objects.name)
      )
    )
  );
drop policy if exists "Admins can upload library files" on storage.objects;
create policy "Admins can upload library files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'library-files' and public.is_library_admin()
  );
drop policy if exists "Admins can update library files" on storage.objects;
create policy "Admins can update library files" on storage.objects
  for update to authenticated using (
    bucket_id = 'library-files' and public.is_library_admin()
  ) with check (bucket_id = 'library-files' and public.is_library_admin());
drop policy if exists "Admins can delete library files" on storage.objects;
create policy "Admins can delete library files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'library-files' and public.is_library_admin()
  );

insert into public.categories (name_ar, name_en, is_coming_soon, position)
values
  ('المالية', 'Finance', false, 0),
  ('المراجعة', 'Revision', false, 1),
  ('السناتر', 'Centers', false, 2),
  ('المنشآت', 'Businesses', false, 3),
  ('الضرائب', 'Tax', true, 4),
  ('التكاليف', 'Cost accounting', true, 5)
on conflict (name_ar) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'files'
  ) then
    alter publication supabase_realtime add table public.files;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
  ) then
    alter publication supabase_realtime add table public.categories;
  end if;
end
$$;
