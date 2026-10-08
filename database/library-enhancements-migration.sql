alter table public.files
  add column if not exists is_new boolean not null default false;

alter table public.notifications
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('library-files', 'library-files', false, 1073741824)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;

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
      or exists (
        select 1
        from public.notifications,
             lateral jsonb_array_elements(public.notifications.attachments) as attachment(item)
        where public.notifications.is_active = true
          and attachment.item->>'object_path' = storage.objects.name
      )
    )
  );
