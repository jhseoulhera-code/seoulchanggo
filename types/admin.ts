import type {
  AuthProviderEnum,
  CouponDiscountTypeEnum,
  CurrencyCodeEnum,
  InquiryStatusEnum,
  LocaleCodeEnum,
  MarketCodeEnum,
  OrderStatusEnum,
  PaymentAttemptStatusEnum,
  PaymentMethodEnum,
  PaymentProviderEnum,
  PaymentStatusEnum,
  PointTransactionTypeEnum,
  ReviewStatusEnum,
  ShippingGroupStatusEnum,
  ShippingMethodEnum,
  ShippingTypeEnum,
  StockTypeEnum,
  SupplyTypeEnum,
  UserRoleEnum,
} from "@/types/database";

export type AdminProductListItem = {
  id: string;
  sku: string;
  slug: string;
  nameKo: string;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  supplyType: SupplyTypeEnum;
  shippingType: ShippingTypeEnum;
  krPrice: number | null;
  inPrice: number | null;
  stockQuantity: number;
  stockType: StockTypeEnum;
  isActive: boolean;
  primaryImageUrl: string | null;
};

export type AdminProductPrice = {
  marketCode: MarketCodeEnum;
  currencyCode: CurrencyCodeEnum;
  originalPrice: number;
  salePrice: number;
};

export type AdminProductShippingMarket = {
  countryCode: MarketCodeEnum;
  isAvailable: boolean;
  shippingFee: number;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  shippingMethod: ShippingMethodEnum | null;
};

export type AdminProductVariant = {
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  additionalPrice: number;
  stockQuantity: number;
  isActive: boolean;
};

export type AdminProductImage = {
  id: string;
  imageUrl: string;
  altKo: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type AdminOptionGroup = {
  name: string;
  choices: string[];
};

export type AdminProductDetail = {
  id: string | null;
  sku: string;
  categoryId: string;
  slug: string;
  brand: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  originCountry: string;
  supplyType: SupplyTypeEnum;
  shippingType: ShippingTypeEnum;
  defaultShippingMethod: ShippingMethodEnum | null;
  stockType: StockTypeEnum;
  stockQuantity: number;
  optionGroups: AdminOptionGroup[];
  isActive: boolean;
  freeShipping: boolean;
  discountRate: number | null;
  prices: AdminProductPrice[];
  shippingMarkets: AdminProductShippingMarket[];
  variants: AdminProductVariant[];
  images: AdminProductImage[];
};

export type AdminCategory = {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  iconName: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isVisible: boolean;
  showOnHome: boolean;
};

export type AdminHomeSectionItem = {
  itemId: string;
  productId: string;
  productNameKo: string;
  sortOrder: number;
};

export type AdminHomeSection = {
  id: string;
  sectionKey: string;
  titleKo: string;
  titleEn: string;
  sortOrder: number;
  isActive: boolean;
  items: AdminHomeSectionItem[];
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  createdAt: string;
  isGuest: boolean;
  customerName: string;
  customerEmail: string;
  marketCode: MarketCodeEnum;
  currencyCode: CurrencyCodeEnum;
  destinationCountries: MarketCodeEnum[];
  itemCount: number;
  totalAmount: number;
  paymentStatus: PaymentStatusEnum;
  orderStatus: OrderStatusEnum;
};

export type AdminOrderItem = {
  id: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  optionSnapshot: Record<string, string>;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  shippingType: ShippingTypeEnum;
  originCountry: string | null;
};

export type AdminShippingGroup = {
  id: string;
  shippingType: ShippingTypeEnum;
  shippingMethod: ShippingMethodEnum | null;
  destinationCountry: MarketCodeEnum;
  shippingFee: number;
  status: ShippingGroupStatusEnum;
  carrier: string | null;
  trackingNumber: string | null;
  itemIds: string[];
};

export type AdminPaymentAttempt = {
  id: string;
  provider: PaymentProviderEnum;
  paymentMethod: PaymentMethodEnum;
  amount: number;
  currencyCode: CurrencyCodeEnum;
  status: PaymentAttemptStatusEnum;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  createdAt: string;
  marketCode: MarketCodeEnum;
  currencyCode: CurrencyCodeEnum;
  paymentMethod: PaymentMethodEnum;
  paymentStatus: PaymentStatusEnum;
  orderStatus: OrderStatusEnum;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  isGuest: boolean;
  shippingAddress: Record<string, unknown>;
  customsCode: string | null;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  items: AdminOrderItem[];
  shippingGroups: AdminShippingGroup[];
  payments: AdminPaymentAttempt[];
};

export type AdminCustomerListItem = {
  id: string;
  displayName: string;
  email: string;
  authProvider: AuthProviderEnum;
  marketCode: MarketCodeEnum;
  createdAt: string;
  orderCount: number;
  totalSpentByCurrency: { currencyCode: CurrencyCodeEnum; amount: number }[];
};

export type AdminCustomerDetail = AdminCustomerListItem & {
  localeCode: LocaleCodeEnum;
  marketingOptIn: boolean;
  role: UserRoleEnum;
  orders: AdminOrderListItem[];
};

export type AdminDashboardStats = {
  todayOrderCount: number;
  todayRevenueByCurrency: { currencyCode: CurrencyCodeEnum; amount: number }[];
  paymentPendingCount: number;
  preparingCount: number;
  shippingCount: number;
  cancelReturnRequestCount: number;
  lowStockCount: number;
};

export type AdminLowStockItem = {
  productId: string;
  variantId: string | null;
  label: string;
  sku: string;
  stockQuantity: number;
  status: "LOW" | "OUT";
};

export type AdminInventoryItem = {
  productId: string;
  variantId: string | null;
  productNameKo: string;
  variantLabel: string | null;
  sku: string;
  stockQuantity: number;
  status: "OK" | "LOW" | "OUT";
};

export type AdminCoupon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountTypeEnum;
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount: number | null;
  validFrom: string;
  validUntil: string;
  usageLimit: number | null;
  perUserLimit: number;
  marketCode: MarketCodeEnum | null;
  isActive: boolean;
  usedCount: number;
  productIds: string[];
  categoryIds: string[];
  createdAt: string;
};

export type AdminPointTransaction = {
  id: string;
  type: PointTransactionTypeEnum;
  amount: number;
  balanceAfter: number;
  reason: string;
  orderId: string | null;
  createdAt: string;
};

export type AdminBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  marketCode: MarketCodeEnum | null;
  locale: LocaleCodeEnum | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export type AdminPromotionProduct = { productId: string; productNameKo: string; sortOrder: number };

export type AdminPromotion = {
  id: string;
  slug: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  marketCode: MarketCodeEnum | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  products: AdminPromotionProduct[];
};

export type AdminReview = {
  id: string;
  productId: string;
  productNameKo: string;
  authorName: string;
  rating: number;
  content: string;
  status: ReviewStatusEnum;
  helpfulCount: number;
  createdAt: string;
};

export type AdminInquiry = {
  id: string;
  productId: string;
  productNameKo: string;
  authorName: string;
  question: string;
  status: InquiryStatusEnum;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
};

export type AdminNotice = {
  id: string;
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  isPinned: boolean;
  isActive: boolean;
  publishedAt: string;
};

export type AdminFaq = {
  id: string;
  category: string;
  questionKo: string;
  questionEn: string;
  answerKo: string;
  answerEn: string;
  sortOrder: number;
  isActive: boolean;
};
