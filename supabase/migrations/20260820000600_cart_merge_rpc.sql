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
  v_stock integer;
  v_options jsonb;
  v_quantity integer;
  v_existing_qty integer;
begin
  if auth.uid() is null then
    raise exception 'merge_guest_cart requires an authenticated caller';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id, stock_quantity into v_product_id, v_stock
    from public.products
    where slug = (v_item ->> 'product_id') and is_active = true;

    if v_product_id is null then
      continue; -- product no longer exists or is inactive — drop it silently rather than fail the whole merge
    end if;

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
      values (auth.uid(), v_product_id, v_options, least(v_quantity, greatest(v_stock, 1)));
    else
      update public.cart_items
      set quantity = least(v_existing_qty + v_quantity, greatest(v_stock, 1))
      where user_id = auth.uid()
        and product_id = v_product_id
        and variant_id is null
        and selected_options = v_options;
    end if;
  end loop;
end;
$$;

grant execute on function public.merge_guest_cart to authenticated;
