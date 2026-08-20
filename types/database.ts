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
export type UserRoleEnum = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
export type CouponDiscountTypeEnum = "FIXED" | "PERCENT";
export type PointTransactionTypeEnum = "EARN" | "USE" | "CANCEL_EARN" | "REFUND" | "ADMIN_ADJUST";
export type ReviewStatusEnum = "PUBLISHED" | "HIDDEN" | "REPORTED";
export type InquiryStatusEnum = "PENDING" | "ANSWERED" | "HIDDEN";

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
  role: UserRoleEnum;
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
  coupon_id: string | null;
  coupon_discount_amount: number;
  points_used: number;
  points_discount_amount: number;
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

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: CouponDiscountTypeEnum;
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount_amount: number | null;
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
  per_user_limit: number;
  market_code: MarketCodeEnum | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CouponProductRow = { coupon_id: string; product_id: string };
export type CouponCategoryRow = { coupon_id: string; category_id: string };

export type CouponUsageRow = {
  id: string;
  coupon_id: string;
  user_id: string | null;
  order_id: string;
  used_at: string;
};

export type PointTransactionRow = {
  id: string;
  user_id: string;
  type: PointTransactionTypeEnum;
  amount: number;
  balance_after: number;
  reason: string;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  market_code: MarketCodeEnum | null;
  locale: LocaleCodeEnum | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromotionRow = {
  id: string;
  slug: string;
  title_ko: string;
  title_en: string;
  description_ko: string | null;
  description_en: string | null;
  image_url: string | null;
  market_code: MarketCodeEnum | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromotionProductRow = { promotion_id: string; product_id: string; sort_order: number };

export type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  order_item_id: string | null;
  rating: number;
  content: string;
  option_snapshot: Json;
  status: ReviewStatusEnum;
  helpful_count: number;
  created_at: string;
  updated_at: string;
};

export type ReviewImageRow = { id: string; review_id: string; image_url: string; sort_order: number };
export type ReviewHelpfulVoteRow = { review_id: string; user_id: string; created_at: string };

export type ProductInquiryRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  author_name: string;
  question: string;
  status: InquiryStatusEnum;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
};

export type NoticeRow = {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  is_pinned: boolean;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type FaqRow = {
  id: string;
  category: string;
  question_ko: string;
  question_en: string;
  answer_ko: string;
  answer_en: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
      home_sections: Table<HomeSectionRow, never, Partial<HomeSectionRow>>;
      home_section_items: Table<
        HomeSectionItemRow,
        Omit<HomeSectionItemRow, "id" | "created_at"> & { id?: string },
        Partial<HomeSectionItemRow>
      >;
      coupons: Table<CouponRow, Omit<CouponRow, "id" | "created_at" | "updated_at"> & { id?: string }, Partial<CouponRow>>;
      coupon_products: Table<CouponProductRow, CouponProductRow, never>;
      coupon_categories: Table<CouponCategoryRow, CouponCategoryRow, never>;
      coupon_usages: Table<CouponUsageRow, never, never>;
      point_transactions: Table<PointTransactionRow, never, never>;
      banners: Table<BannerRow, Omit<BannerRow, "id" | "created_at" | "updated_at"> & { id?: string }, Partial<BannerRow>>;
      promotions: Table<
        PromotionRow,
        Omit<PromotionRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<PromotionRow>
      >;
      promotion_products: Table<PromotionProductRow, PromotionProductRow, Partial<PromotionProductRow>>;
      reviews: Table<
        ReviewRow,
        Omit<ReviewRow, "id" | "created_at" | "updated_at" | "helpful_count" | "status"> & {
          id?: string;
          status?: ReviewStatusEnum;
        },
        Partial<ReviewRow>
      >;
      review_images: Table<ReviewImageRow, Omit<ReviewImageRow, "id"> & { id?: string }, never>;
      review_helpful_votes: Table<ReviewHelpfulVoteRow, Pick<ReviewHelpfulVoteRow, "review_id" | "user_id">, never>;
      product_inquiries: Table<
        ProductInquiryRow,
        Omit<ProductInquiryRow, "id" | "created_at" | "status" | "answer" | "answered_by" | "answered_at"> & {
          id?: string;
        },
        Partial<ProductInquiryRow>
      >;
      notices: Table<NoticeRow, Omit<NoticeRow, "id" | "created_at" | "updated_at"> & { id?: string }, Partial<NoticeRow>>;
      faqs: Table<FaqRow, Omit<FaqRow, "id" | "created_at" | "updated_at"> & { id?: string }, Partial<FaqRow>>;
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
          p_coupon_code?: string | null;
          p_points_used?: number;
        };
        Returns: string;
      };
      validate_coupon_code: {
        Args: {
          p_code: string;
          p_market_code: MarketCodeEnum;
          p_subtotal: number;
          p_product_ids: (string | null)[];
        };
        Returns: Json;
      };
      list_available_coupons: {
        Args: { p_market_code: MarketCodeEnum };
        Returns: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          discount_type: CouponDiscountTypeEnum;
          discount_value: number;
          minimum_order_amount: number;
          maximum_discount_amount: number | null;
          valid_until: string;
        }[];
      };
      get_point_balance: {
        Args: { p_user_id: string };
        Returns: number;
      };
      admin_adjust_points: {
        Args: { p_user_id: string; p_amount: number; p_reason: string };
        Returns: undefined;
      };
      lookup_guest_order_full: {
        Args: { p_order_number: string; p_contact: string };
        Returns: Json | null;
      };
      merge_guest_cart: {
        Args: { p_items: Json };
        Returns: undefined;
      };
      admin_update_shipping_group: {
        Args: {
          p_shipping_group_id: string;
          p_status: ShippingGroupStatusEnum;
          p_carrier: string | null;
          p_tracking_number: string | null;
        };
        Returns: undefined;
      };
      admin_upsert_product: {
        Args: {
          p_id: string | null;
          p_sku: string;
          p_category_id: string;
          p_slug: string;
          p_brand: string | null;
          p_name_ko: string;
          p_name_en: string | null;
          p_description_ko: string | null;
          p_description_en: string | null;
          p_origin_country: string | null;
          p_supply_type: SupplyTypeEnum;
          p_shipping_type: ShippingTypeEnum;
          p_default_shipping_method: ShippingMethodEnum | null;
          p_stock_type: StockTypeEnum;
          p_stock_quantity: number;
          p_option_groups: Json;
          p_is_active: boolean;
          p_free_shipping: boolean;
          p_discount_rate: number | null;
          p_prices: Json;
          p_shipping_markets: Json;
        };
        Returns: string;
      };
      admin_set_primary_image: {
        Args: { p_product_id: string; p_image_id: string };
        Returns: undefined;
      };
    };
  };
};
