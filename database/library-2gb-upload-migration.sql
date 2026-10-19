insert into storage.buckets (id, name, public, file_size_limit)
values ('library-files', 'library-files', false, 2147483648)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;
