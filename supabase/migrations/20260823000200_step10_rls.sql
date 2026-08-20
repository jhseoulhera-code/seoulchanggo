-- STEP 10: RLS for coupons/points/banners/promotions/reviews/inquiries/notices/faqs.
-- Same posture as STEP 08/09: every table enables RLS; anon/authenticated get
-- only the narrow access the app needs; is_admin() (STEP 09) gates writes;
-- anything requiring cross-table validation (coupon usage, point balance,
-- review purchase-gating) has NO direct client write policy at all — those
-- go exclusively through SECURITY DEFINER RPCs (000300 migration) so the
-- validation can never be bypassed by calling the table directly.

-- ---------------------------------------------------------------------------
-- coupons — no direct SELECT for anon/authenticated (would let anyone
-- enumerate every code ever issued). Available/valid coupons are read
-- through list_available_coupons()/validate_coupon_code() instead.
-- ---------------------------------------------------------------------------
alter table public.coupons enable row level security;
create policy coupons_admin_read_all on public.coupons for select using (public.is_admin());
create policy coupons_admin_write on public.coupons for insert with check (public.is_admin());
create policy coupons_admin_update on public.coupons for update using (public.is_admin()) with check (public.is_admin());

alter table public.coupon_products enable row level security;
create policy coupon_products_admin_read on public.coupon_products for select using (public.is_admin());
create policy coupon_products_admin_write on public.coupon_products for insert with check (public.is_admin());
create policy coupon_products_admin_delete on public.coupon_products for delete using (public.is_admin());

alter table public.coupon_categories enable row level security;
create policy coupon_categories_admin_read on public.coupon_categories for select using (public.is_admin());
create policy coupon_categories_admin_write on public.coupon_categories for insert with check (public.is_admin());
create policy coupon_categories_admin_delete on public.coupon_categories for delete using (public.is_admin());

-- coupon_usages — a user can see their own usage history (STEP 10 spec
-- section 36: "다른 사용자의 쿠폰 사용내역 노출 금지"); admins see all. No
-- insert/update/delete policy for anyone — only create_order() (SECURITY
-- DEFINER) writes here.
alter table public.coupon_usages enable row level security;
create policy coupon_usages_select_own on public.coupon_usages for select using (auth.uid() = user_id);
create policy coupon_usages_admin_read_all on public.coupon_usages for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- point_transactions — same shape: own rows only, or admin. No client
-- insert policy — admin_adjust_points()/create_order()/the delivered-order
-- earn trigger are the only writers (STEP 10 spec section 36: "포인트 잔액
-- client 계산만 신뢰 금지").
-- ---------------------------------------------------------------------------
alter table public.point_transactions enable row level security;
create policy point_transactions_select_own on public.point_transactions for select using (auth.uid() = user_id);
create policy point_transactions_admin_read_all on public.point_transactions for select using (public.is_admin());

alter table public.app_settings enable row level security;
create policy app_settings_admin_read on public.app_settings for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- banners — public read of active rows (date-window checked at the query
-- layer, since RLS can't cheaply express "now() between nullable bounds"
-- without repeating it per policy; the repository always adds it too).
-- ---------------------------------------------------------------------------
alter table public.banners enable row level security;
create policy banners_public_read on public.banners for select using (is_active = true);
create policy banners_admin_read_all on public.banners for select using (public.is_admin());
create policy banners_admin_write on public.banners for insert with check (public.is_admin());
create policy banners_admin_update on public.banners for update using (public.is_admin()) with check (public.is_admin());
create policy banners_admin_delete on public.banners for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------------
alter table public.promotions enable row level security;
create policy promotions_public_read on public.promotions for select using (is_active = true);
create policy promotions_admin_read_all on public.promotions for select using (public.is_admin());
create policy promotions_admin_write on public.promotions for insert with check (public.is_admin());
create policy promotions_admin_update on public.promotions for update using (public.is_admin()) with check (public.is_admin());

alter table public.promotion_products enable row level security;
create policy promotion_products_public_read on public.promotion_products for select using (
  exists (select 1 from public.promotions p where p.id = promotion_products.promotion_id and p.is_active = true)
);
create policy promotion_products_admin_read_all on public.promotion_products for select using (public.is_admin());
create policy promotion_products_admin_write on public.promotion_products for insert with check (public.is_admin());
create policy promotion_products_admin_update on public.promotion_products for update using (public.is_admin()) with check (public.is_admin());
create policy promotion_products_admin_delete on public.promotion_products for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- reviews — public read of PUBLISHED rows (guests included, matches STEP 04's
-- always-visible dummy reviews). The insert policy IS the purchase/delivery
-- gate (STEP 10 spec section 18): order_items already carries an
-- owner-only SELECT policy (STEP 08), so this EXISTS subquery runs under the
-- inserting user's own read access — no SECURITY DEFINER function needed.
-- Admin can read everything (incl. HIDDEN/REPORTED) and update status only
-- (moderation) — never content, per spec section 21.
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;
create policy reviews_public_read_published on public.reviews for select using (status = 'PUBLISHED');
create policy reviews_admin_read_all on public.reviews for select using (public.is_admin());
create policy reviews_insert_own on public.reviews for insert with check (
  auth.uid() = user_id
  and order_item_id is not null
  and exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = reviews.order_item_id
      and oi.product_id = reviews.product_id
      and o.user_id = auth.uid()
      and o.order_status = 'DELIVERED'
  )
);
create policy reviews_admin_update_status on public.reviews for update using (public.is_admin()) with check (public.is_admin());

alter table public.review_images enable row level security;
create policy review_images_public_read on public.review_images for select using (
  exists (select 1 from public.reviews r where r.id = review_images.review_id and r.status = 'PUBLISHED')
);
create policy review_images_admin_read_all on public.review_images for select using (public.is_admin());
create policy review_images_insert_own on public.review_images for insert with check (
  exists (select 1 from public.reviews r where r.id = review_images.review_id and r.user_id = auth.uid())
);

-- review_helpful_votes — a straightforward toggle, safe to let clients write
-- directly: the primary key stops double-voting and the trigger above keeps
-- helpful_count in sync, so there's nothing here an RPC would add.
alter table public.review_helpful_votes enable row level security;
create policy review_helpful_votes_select_own on public.review_helpful_votes for select using (auth.uid() = user_id);
create policy review_helpful_votes_insert_own on public.review_helpful_votes for insert with check (auth.uid() = user_id);
create policy review_helpful_votes_delete_own on public.review_helpful_votes for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- product_inquiries — PENDING/ANSWERED publicly visible (matches STEP 04's
-- always-visible dummy inquiries); HIDDEN is admin-only. A member can post
-- their own question directly (no cross-table gate needed, unlike reviews),
-- but the WITH CHECK below stops them from posting a pre-answered inquiry or
-- impersonating the answering admin. Only admins can update (answer) one.
-- ---------------------------------------------------------------------------
alter table public.product_inquiries enable row level security;
create policy product_inquiries_public_read on public.product_inquiries for select using (status <> 'HIDDEN');
create policy product_inquiries_admin_read_all on public.product_inquiries for select using (public.is_admin());
create policy product_inquiries_insert_own on public.product_inquiries for insert with check (
  auth.uid() = user_id and status = 'PENDING' and answer is null and answered_by is null and answered_at is null
);
create policy product_inquiries_admin_answer on public.product_inquiries for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- notices / faqs — public read of active rows, admin write.
-- ---------------------------------------------------------------------------
alter table public.notices enable row level security;
create policy notices_public_read on public.notices for select using (is_active = true);
create policy notices_admin_read_all on public.notices for select using (public.is_admin());
create policy notices_admin_write on public.notices for insert with check (public.is_admin());
create policy notices_admin_update on public.notices for update using (public.is_admin()) with check (public.is_admin());

alter table public.faqs enable row level security;
create policy faqs_public_read on public.faqs for select using (is_active = true);
create policy faqs_admin_read_all on public.faqs for select using (public.is_admin());
create policy faqs_admin_write on public.faqs for insert with check (public.is_admin());
create policy faqs_admin_update on public.faqs for update using (public.is_admin()) with check (public.is_admin());
