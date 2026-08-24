-- STEP 26.1: add a DIRECT_PICKUP shipping method. Enum additions ONLY in
-- this file — Postgres cannot safely use a value added by ALTER TYPE ...
-- ADD VALUE inside the same transaction/migration that adds it (a function
-- body referencing the new value would fail to compile against the
-- not-yet-committed enum). Every place that actually USES these new values
-- (create_order, is_valid_shipping_status_transition, compute_order_status,
-- admin_update_shipping_group, admin_finalize_refund) is a SEPARATE, later
-- migration (20260906000900_step26_1_direct_pickup_logic.sql) that runs
-- after this one has fully committed.
--
-- Investigation (STEP 26.1 spec section 1): shipping_type_enum (DOMESTIC/
-- OVERSEAS_DIRECT/OVERSEAS_AGENCY) is the field that actually drives
-- shipping-group splitting in create_order (v_group_key :=
-- v_product.shipping_type::text) and the customer-facing "배송유형" concept
-- throughout the app — DIRECT_PICKUP belongs here, not in
-- shipping_method_enum (SEA/AIR), which is only ever a supplementary
-- international-transport-mode detail that never drives grouping and stays
-- null for both DOMESTIC and DIRECT_PICKUP alike. The "DOMESTIC_PARCEL/
-- OVERSEAS_SEA/OVERSEAS_AIR" wording in the STEP 26.1 spec is UI-level
-- shorthand for shipping_type+shipping_method combinations, not a literal
-- reference to shipping_method_enum's own two values.
alter type public.shipping_type_enum add value 'DIRECT_PICKUP';

-- shipping_group_status_enum gains a DIRECT_PICKUP-only branch (spec section
-- 4's recommended flow, adopted after impact analysis: every touch point —
-- is_valid_shipping_status_transition, compute_order_status, the payment-
-- before-ship gate in admin_update_shipping_group, and the refund stock-
-- restore eligibility check in admin_finalize_refund — is a small, additive
-- change, not a redesign). PREPARING → READY_FOR_PICKUP → PICKED_UP mirrors
-- the existing PREPARING → READY_TO_SHIP → SHIPPED shape for courier
-- groups; a courier-based group can never enter either new value (no edge
-- into them exists for any other current status).
alter type public.shipping_group_status_enum add value 'READY_FOR_PICKUP';
alter type public.shipping_group_status_enum add value 'PICKED_UP';
