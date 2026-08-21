-- STEP 08: guest → member cart merge (spec section 11).
-- Same product + same options → quantities are summed (capped at stock);
-- different options → a separate cart_items row, same as the localStorage cart.
--
-- Items are addressed by product SLUG, not UUID: the guest (localStorage) cart
-- only ever knows a product by its app-level slug (types/cart.ts's CartItem.productId),
-- so this resolves slug -> id server-side rather than requiring the browser to
-- look up every UUID first.

create or replace function public.merge_guest_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_stock_type public.stock_type_enum;
  v_stock integer;
  v_max_quantity integer;
  v_options jsonb;
  v_quantity integer;
  v_existing_qty integer;
begin
  if auth.uid() is null then
    raise exception 'merge_guest_cart requires an authenticated caller';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id, stock_type, stock_quantity into v_product_id, v_stock_type, v_stock
    from public.products
    where slug = (v_item ->> 'product_id') and is_active = true;

    if v_product_id is null then
      continue; -- product no longer exists or is inactive — drop it silently rather than fail the whole merge
    end if;

    -- STEP 15 fix: stock_quantity is meaningless for an UNLIMITED-stock
    -- product (it defaults to 0, since nothing ever reads it) — capping by
    -- it unconditionally silently dropped every UNLIMITED-stock merge down
    -- to quantity 1, discovered by actually running this against seeded
    -- data (best-3 is UNLIMITED with stock_quantity=0). Mirrors the
    -- TS layer's own pattern (lib/supabaseCartStore.ts's maxStock, sourced
    -- from mapProductRow's `stock_type === "TRACKED" ? stock_quantity :
    -- undefined`): no cap at all unless the product is actually TRACKED.
    v_max_quantity := case when v_stock_type = 'TRACKED' then greatest(v_stock, 1) else null end;

    v_options := coalesce(v_item -> 'selected_options', '{}'::jsonb);
    v_quantity := (v_item ->> 'quantity')::integer;

    select quantity into v_existing_qty
    from public.cart_items
    where user_id = auth.uid()
      and product_id = v_product_id
      and variant_id is null
      and selected_options = v_options;

    if v_existing_qty is null then
      insert into public.cart_items (user_id, product_id, selected_options, quantity)
      values (auth.uid(), v_product_id, v_options, case when v_max_quantity is null then v_quantity else least(v_quantity, v_max_quantity) end);
    else
      update public.cart_items
      set quantity = case when v_max_quantity is null then v_existing_qty + v_quantity else least(v_existing_qty + v_quantity, v_max_quantity) end
      where user_id = auth.uid()
        and product_id = v_product_id
        and variant_id is null
        and selected_options = v_options;
    end if;
  end loop;
end;
$$;

grant execute on function public.merge_guest_cart to authenticated;
