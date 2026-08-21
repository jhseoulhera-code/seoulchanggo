-- STEP 14 production hardening (spec section 11): an order stuck in
-- ORDER_CREATED/PAYMENT_PENDING for too long (payment abandoned, tab
-- closed, PG timeout) must not hold a coupon usage slot or a customer's
-- points hostage forever. cancel_unpaid_order() already covers the manual
-- admin path (STEP 11); this adds the automatic side, structured the same
-- way as process_webhook_payment_event() — deliberately NOT granted to
-- anon/authenticated, so only trusted server code calling with the
-- service-role key (which bypasses grants entirely) can invoke it. There is
-- no signed-in admin session in a scheduled-job context, so this is gated
-- by which Postgres role may EXECUTE it rather than by is_admin().
--
-- The staleness threshold is configurable via app_settings
-- ('orders.stale_cancel_minutes'), never hardcoded, so an operator can tune
-- it without a redeploy or code change; it defaults to 60 minutes until an
-- operator sets a different value. Whether anything actually calls this
-- function on a schedule is a separate, explicit decision — see
-- app/api/internal/cancel-stale-orders/route.ts and vercel.json.

insert into public.app_settings (key, value) values
  ('orders.stale_cancel_minutes', '60')
on conflict (key) do nothing;

create or replace function public.auto_cancel_stale_orders()
returns table (cancelled_order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_age_minutes integer;
  v_order public.orders%rowtype;
  v_balance integer;
begin
  select (value)::text::integer into v_max_age_minutes
  from public.app_settings where key = 'orders.stale_cancel_minutes';
  v_max_age_minutes := coalesce(v_max_age_minutes, 60);

  for v_order in
    select * from public.orders
    where order_status in ('ORDER_CREATED', 'PAYMENT_PENDING')
      and payment_status <> 'PAID'
      and created_at < now() - (v_max_age_minutes || ' minutes')::interval
    for update skip locked
  loop
    update public.orders set order_status = 'CANCELLED' where id = v_order.id;
    delete from public.coupon_usages where order_id = v_order.id;

    if v_order.points_used > 0 and v_order.user_id is not null then
      select coalesce(sum(amount), 0) into v_balance from public.point_transactions where user_id = v_order.user_id;
      insert into public.point_transactions (user_id, type, amount, balance_after, reason, order_id)
      values (v_order.user_id, 'REFUND', v_order.points_used, v_balance + v_order.points_used, '결제 미완료로 자동 취소', v_order.id);
    end if;

    cancelled_order_id := v_order.id;
    return next;
  end loop;
end;
$$;
