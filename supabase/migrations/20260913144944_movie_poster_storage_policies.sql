create policy "catalogue team can list movie posters"
on storage.objects for select
to authenticated
using (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
);

create policy "catalogue team can upload movie posters"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
);

create policy "catalogue team can update movie posters"
on storage.objects for update
to authenticated
using (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
)
with check (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
);

create policy "admins can delete movie posters"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'movie-posters'
  and public.is_admin()
);