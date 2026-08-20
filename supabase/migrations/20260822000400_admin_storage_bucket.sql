-- STEP 09 spec section 14/16: product-images Storage bucket, ready for when
-- file upload is wired up. The admin product-image UI this step uses a URL
-- input instead (see components/admin/products/ImageManager.tsx) because file
-- upload can't be verified without a live project — this migration just makes
-- sure the bucket + policies exist the moment one is connected, so upload can
-- be turned on later without another migration.
--
-- Public read (product photos are public marketing assets, same as any
-- storefront); only admin can insert/update/delete. Regular customers get
-- neither.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy product_images_bucket_public_read on storage.objects
  for select using (bucket_id = 'product-images');

create policy product_images_bucket_admin_insert on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_bucket_admin_update on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());

create policy product_images_bucket_admin_delete on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
