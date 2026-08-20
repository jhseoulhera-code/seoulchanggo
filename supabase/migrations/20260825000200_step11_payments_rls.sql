-- STEP 11: RLS for payments/payment_events/payment_refunds. Same posture as
-- every other STEP 08~10 table: RLS enabled on all three, no direct client
-- INSERT/UPDATE policy anywhere — every write goes through the SECURITY
-- DEFINER RPCs in 20260825000300_step11_payment_rpcs.sql (prepare_payment/
-- confirm_payment) or, for webhooks, through the service-role key (which
-- bypasses RLS entirely, so it needs no policy at all).

alter table public.payments enable row level security;

create policy payments_select_own on public.payments for select using (
  exists (select 1 from public.orders o where o.id = payments.order_id and o.user_id = auth.uid())
);
create policy payments_admin_read_all on public.payments for select using (public.is_admin());

alter table public.payment_events enable row level security;

create policy payment_events_admin_read_all on public.payment_events for select using (public.is_admin());

alter table public.payment_refunds enable row level security;

create policy payment_refunds_select_own on public.payment_refunds for select using (
  exists (
    select 1 from public.payments p
    join public.orders o on o.id = p.order_id
    where p.id = payment_refunds.payment_id and o.user_id = auth.uid()
  )
);
create policy payment_refunds_admin_read_all on public.payment_refunds for select using (public.is_admin());
