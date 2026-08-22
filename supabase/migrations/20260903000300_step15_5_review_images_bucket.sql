-- STEP 15.5 finding: review_images.image_url (20260823000100_step10_schema.sql)
-- has always been a plain text column with nothing behind it — the write
-- flow (lib/actions/reviews.ts's submitReviewAction) already accepts a
-- ready-made imageUrls: string[] and just inserts them, but no Storage
-- bucket has ever existed for a customer to actually produce one, and no
-- upload UI calls it with anything but `[]` (components/product/ReviewsTab.tsx).
-- This mirrors exactly the reasoning already on record for product-images
-- (20260822000400_admin_storage_bucket.sql: "ready for when file upload is
-- wired up") — the same gap, just never closed for the customer-facing
-- side. Closing the backend half now that a real Cloud project exists to
-- verify Storage policies against; the upload UI/form itself is a separate,
-- larger feature and out of this migration's scope.
--
-- Public read (a review's photos are visible to any visitor, same as a
-- product photo). Write is scoped per-owner via the object path convention
-- `{user_id}/{filename}` — storage.foldername(name) splits the path on '/',
-- so foldername(name)[1] is the first path segment a caller uploaded under.
-- This is enforced independently of review_images/reviews RLS: a customer
-- can only ever write under their own auth.uid() folder, never another
-- user's, and never product-images (a different bucket_id entirely).
insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

create policy review_images_bucket_public_read on storage.objects
  for select using (bucket_id = 'review-images');

create policy review_images_bucket_own_insert on storage.objects
  for insert with check (
    bucket_id = 'review-images' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy review_images_bucket_own_delete on storage.objects
  for delete using (
    bucket_id = 'review-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
