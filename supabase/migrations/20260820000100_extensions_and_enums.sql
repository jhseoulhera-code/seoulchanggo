-- STEP 08: extensions + shared enum types.
-- Every enum here mirrors a TypeScript union already used by the app (see types/*.ts);
-- keep both sides in sync when either changes.

create extension if not exists pgcrypto;

create type public.auth_provider_enum as enum ('EMAIL', 'GOOGLE', 'KAKAO', 'NAVER');
create type public.locale_code_enum as enum ('ko', 'en');
create type public.market_code_enum as enum ('KR', 'IN');
create type public.currency_code_enum as enum ('KRW', 'INR', 'USD');

-- How the seller sources inventory for a product.
create type public.supply_type_enum as enum ('DOMESTIC_STOCK', 'OVERSEAS_DIRECT', 'OVERSEAS_AGENCY');

-- Customer-facing shipping category — matches app/types/index.ts ShippingType
-- (DOMESTIC = domestic, OVERSEAS_DIRECT = overseas_direct, OVERSEAS_AGENCY = overseas_agent).
create type public.shipping_type_enum as enum ('DOMESTIC', 'OVERSEAS_DIRECT', 'OVERSEAS_AGENCY');

create type public.shipping_method_enum as enum ('SEA', 'AIR');

create type public.order_status_enum as enum (
  'ORDER_CREATED', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'PARTIALLY_SHIPPED',
  'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'
);

create type public.shipping_group_status_enum as enum (
  'PREPARING', 'PURCHASING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT',
  'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED'
);

-- Matches types/order.ts PaymentMethodId.
create type public.payment_method_enum as enum ('card', 'easy_pay', 'bank_transfer', 'upi', 'net_banking', 'wallet');

-- Deliberately minimal — there is no real PG integration yet (see STEP 06/08 scope notes).
create type public.payment_status_enum as enum ('UNPAID', 'PAID');

-- Whether a product's stock is actively tracked or treated as always-available.
create type public.stock_type_enum as enum ('TRACKED', 'UNLIMITED');
