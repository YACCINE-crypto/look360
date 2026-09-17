-- Bucket public pour les images produit (lecture publique, écriture par le
-- propriétaire connecté dans son dossier {uid}/...).
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do update set public = true;

drop policy if exists "produits_public_read" on storage.objects;
create policy "produits_public_read" on storage.objects
  for select using (bucket_id = 'produits');

drop policy if exists "produits_auth_insert" on storage.objects;
create policy "produits_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produits_auth_update" on storage.objects;
create policy "produits_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'produits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produits_auth_delete" on storage.objects;
create policy "produits_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produits' and (storage.foldername(name))[1] = auth.uid()::text);
