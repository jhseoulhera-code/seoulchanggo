import type { ShippingType } from "@/types";
import type { SelectedOptions } from "@/types/cart";
import type { CountryCode, CurrencyCode, InternationalShippingMethod, OriginCountryCode } from "@/types/market";

export type GuestCustomer = {
  name: string;
  phone: string;
  email: string;
};

export type KoreaShippingAddress = {
  country: "KR";
  recipientName: string;
  phone: string;
  postcode: string;
  address: string;
  addressDetail: string;
  deliveryMemo: string;
};

export type IndiaShippingAddress = {
  country: "IN";
  fullName: string;
  mobileNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  deliveryInstructions: string;
};

/** Add a new market's shape here (e.g. UsShippingAddress) and widen this union. */
export type ShippingAddress = KoreaShippingAddress | IndiaShippingAddress;

export type CustomsInfo = {
  personalCustomsCode: string;
};

export type PaymentMethodId = "card" | "easy_pay" | "bank_transfer" | "upi" | "net_banking" | "wallet";

export type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
};

export type OrderStatus =
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

export type ShippingGroupStatus =
  | "PREPARING"
  | "PURCHASING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "CUSTOMS"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

/**
 * A self-contained checkout line, deliberately decoupled from CartItem/CartLineView
 * so this screen never depends on the cart's internal shape.
 */
export type CheckoutItem = {
  cartItemId?: string;
  productId: string;
  productName: string;
  image: string;
  category: string;
  selectedOptions: SelectedOptions;
  optionLabel: string;
  quantity: number;
  unitPrice: number;
  unitOriginalPrice: number;
  subtotal: number;
  discountAmount: number;
  shippingType: ShippingType;
  shippingLabel: string;
  originCountry?: OriginCountryCode;
  internationalShippingMethod?: InternationalShippingMethod;
  shippingFee: number;
  isAvailable: boolean;
};

export type OrderShippingGroup = {
  shippingType: ShippingType;
  items: CheckoutItem[];
  shippingFee: number;
  status: ShippingGroupStatus;
};

export type Order = {
  orderId: string;
  createdAt: string;
  market: CountryCode;
  currency: CurrencyCode;
  customer: GuestCustomer;
  shippingAddress: ShippingAddress;
  customsInfo?: CustomsInfo;
  items: CheckoutItem[];
  shippingGroups: OrderShippingGroup[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethodId;
  status: OrderStatus;
};
