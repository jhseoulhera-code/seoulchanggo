/**
 * Hand-written to match supabase/migrations/*.sql exactly, since there is no
 * live project yet to generate this from. Once a real Supabase project is
 * linked, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 * and diff against this file before overwriting.
 */

export type AuthProviderEnum = "EMAIL" | "GOOGLE" | "KAKAO" | "NAVER";
export type LocaleCodeEnum = "ko" | "en";
export type MarketCodeEnum = "KR" | "IN";
export type CurrencyCodeEnum = "KRW" | "INR" | "USD";
export type SupplyTypeEnum = "DOMESTIC_STOCK" | "OVERSEAS_DIRECT" | "OVERSEAS_AGENCY";
export type ShippingTypeEnum = "DOMESTIC" | "OVERSEAS_DIRECT" | "OVERSEAS_AGENCY";
export type ShippingMethodEnum = "SEA" | "AIR";
export type OrderStatusEnum =
  | "ORDER_CREATED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PREPARING"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "REFUNDED";
export type ShippingGroupStatusEnum =
  | "PREPARING"
  | "PURCHASING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "CUSTOMS"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";
export type PaymentMethodEnum = "card" | "easy_pay" | "bank_transfer" | "upi" | "net_banking" | "wallet";
export type PaymentStatusEnum = "UNPAID" | "PAID";
export type StockTypeEnum = "TRACKED" | "UNLIMITED";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update };

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  auth_provider: AuthProviderEnum;
  preferred_locale: LocaleCodeEnum;
  preferred_market: MarketCodeEnum;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  slug: string;
  name_ko: string;
  name_en: string;
  icon_name: string | null;
  parent_id: string | null;
  level: number;
  sort_order: number;
  is_visible: boolean;
  show_on_home: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  sku: string;
  category_id: string;
  slug: string;
  brand: string | null;
  name_ko: string;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  origin_country: string | null;
  supply_type: SupplyTypeEnum;
  shipping_type: ShippingTypeEnum;
  default_shipping_method: ShippingMethodEnum | null;
  stock_type: StockTypeEnum;
  stock_quantity: number;
  option_groups: Json;
  is_active: boolean;
  rating: number;
  review_count: number;
  free_shipping: boolean;
  discount_rate: number | null;
  created_at: string;
  updated_at: string;
};

export type ProductPriceRow = {
  id: string;
  product_id: string;
  market_code: MarketCodeEnum;
  currency_code: CurrencyCodeEnum;
  original_price: number;
  sale_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductShippingMarketRow = {
  id: string;
  product_id: string;
  country_code: MarketCodeEnum;
  is_available: boolean;
  shipping_fee: number;
  estimated_min_days: number | null;
  estimated_max_days: number | null;
  shipping_method: ShippingMethodEnum | null;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  image_url: string;
  alt_ko: string | null;
  alt_en: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  sku: string;
  option_values: Json;
  additional_price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CartItemRow = {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  selected_options: Json;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  market_code: MarketCodeEnum;
  currency_code: CurrencyCodeEnum;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  payment_method: PaymentMethodEnum;
  payment_status: PaymentStatusEnum;
  order_status: OrderStatusEnum;
  shipping_address: Json;
  customs_info: Json | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  sku_snapshot: string;
  option_snapshot: Json;
  unit_price: number;
  original_price: number;
  quantity: number;
  shipping_type: ShippingTypeEnum;
  origin_country: string | null;
  created_at: string;
};

export type ShippingGroupRow = {
  id: string;
  order_id: string;
  shipping_type: ShippingTypeEnum;
  shipping_method: ShippingMethodEnum | null;
  origin_country: string | null;
  destination_country: MarketCodeEnum;
  shipping_fee: number;
  status: ShippingGroupStatusEnum;
  carrier: string | null;
  tracking_number: string | null;
  estimated_min_days: number | null;
  estimated_max_days: number | null;
  created_at: string;
  updated_at: string;
};

export type ShippingGroupItemRow = {
  shipping_group_id: string;
  order_item_id: string;
};

export type HomeSectionRow = {
  id: string;
  section_key: string;
  title_ko: string;
  title_en: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HomeSectionItemRow = {
  id: string;
  section_id: string;
  product_id: string;
  sort_order: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, never, Partial<Omit<ProfileRow, "id">>>;
      categories: Table<CategoryRow, Omit<CategoryRow, "id" | "created_at" | "updated_at"> & { id?: string }, Partial<CategoryRow>>;
      products: Table<ProductRow, Omit<ProductRow, "id" | "created_at" | "updated_at"> & { id?: string }, Partial<ProductRow>>;
      product_prices: Table<
        ProductPriceRow,
        Omit<ProductPriceRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<ProductPriceRow>
      >;
      product_shipping_markets: Table<
        ProductShippingMarketRow,
        Omit<ProductShippingMarketRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<ProductShippingMarketRow>
      >;
      product_images: Table<ProductImageRow, Omit<ProductImageRow, "id" | "created_at"> & { id?: string }, Partial<ProductImageRow>>;
      product_variants: Table<
        ProductVariantRow,
        Omit<ProductVariantRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<ProductVariantRow>
      >;
      cart_items: Table<
        CartItemRow,
        Omit<CartItemRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<CartItemRow>
      >;
      orders: Table<OrderRow, never, Partial<OrderRow>>;
      order_items: Table<OrderItemRow, never, never>;
      shipping_groups: Table<ShippingGroupRow, never, Partial<ShippingGroupRow>>;
      shipping_group_items: Table<ShippingGroupItemRow, never, never>;
      home_sections: Table<HomeSectionRow, never, never>;
      home_section_items: Table<HomeSectionItemRow, never, never>;
    };
    Functions: {
      create_order: {
        Args: {
          p_order_number: string;
          p_user_id: string | null;
          p_guest_email: string | null;
          p_guest_phone: string | null;
          p_market_code: MarketCodeEnum;
          p_currency_code: CurrencyCodeEnum;
          p_subtotal: number;
          p_discount_amount: number;
          p_shipping_amount: number;
          p_total_amount: number;
          p_payment_method: PaymentMethodEnum;
          p_shipping_address: Json;
          p_customs_info: Json | null;
          p_items: Json;
        };
        Returns: string;
      };
      lookup_guest_order_full: {
        Args: { p_order_number: string; p_contact: string };
        Returns: Json | null;
      };
      merge_guest_cart: {
        Args: { p_items: Json };
        Returns: undefined;
      };
    };
  };
};
