-- Receipt photos in Supabase Storage
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again.
--
-- Files are stored as receipts/<project_id>/<random>.jpg in a PRIVATE bucket.
-- Access follows the same rules as the expenses table:
--   * view / upload: anyone with access to that project (owner, member, app admin)
--   * delete: project owner or app admin, or the person who uploaded the file

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
on conflict (id) do nothing;

-- Helper: first folder of the object path is the project id.
create or replace function public.receipt_project_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(object_name))[1] ~* '^[0-9a-f-]{36}$'
      then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

drop policy if exists "Receipts: view for project access" on storage.objects;
create policy "Receipts: view for project access"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts'
         and public.has_project_access(public.receipt_project_id(name)));

drop policy if exists "Receipts: upload for project access" on storage.objects;
create policy "Receipts: upload for project access"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts'
              and public.has_project_access(public.receipt_project_id(name)));

drop policy if exists "Receipts: delete by owner or uploader" on storage.objects;
create policy "Receipts: delete by owner or uploader"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipts'
         and (owner_id = auth.uid()::text
              or public.is_project_owner(public.receipt_project_id(name))));
