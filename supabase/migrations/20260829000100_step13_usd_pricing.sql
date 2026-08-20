-- STEP 13 (USD currency addendum): let a product carry an explicit USD
-- price that isn't tied to a shipping-destination Market. product_prices
-- previously required market_code (KR/IN only — see market_code_enum),
-- which conflated "this price's currency" with "this Market's default
-- price." USD is a currency a KR or IN customer can *select* independently
-- of their shipping country (see contexts/MarketContext.tsx's decoupled
-- currency override), so it needs a price row that isn't a shipping-market
-- default: market_code = null, currency_code = 'USD'.
--
-- market_code stays NOT NULL's opposite (nullable) rather than reusing an
-- existing enum value like 'KR'/'IN' — a USD row is not "the IN market's
-- price," it's a currency-only price with no shipping-market meaning, and
-- overloading market_code for that would make every other consumer of
-- market_code_enum (shipping markets, order market_code, banners, etc.)
-- ambiguous about whether a null-shipping "GLOBAL" value is a real
-- destination. currency_code_enum already includes 'USD' (see
-- 20260820000100_extensions_and_enums.sql), so nothing else needs to change
-- there.
alter table public.product_prices alter column market_code drop not null;

-- The old unique(product_id, market_code) constraint still holds for
-- existing KR/IN rows (untouched), but would allow unlimited market_code
-- IS NULL rows per product (SQL treats NULLs as distinct in a unique
-- constraint) — add a second constraint on currency_code so a product can
-- have at most one price per currency, covering the null-market_code USD
-- row too.
alter table public.product_prices
  add constraint product_prices_product_id_currency_code_key unique (product_id, currency_code);
