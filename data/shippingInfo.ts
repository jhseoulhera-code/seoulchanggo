import type { ShippingType } from "@/types";
import type { InternationalShippingMethod, LocaleCode } from "@/types/market";

type Bilingual = { ko: string; en: string };

export type ShippingInfoConfig = {
  title: Bilingual;
  origin: Bilingual;
  eta: Bilingual;
  methodNote: Bilingual;
  defaultFee: Bilingual;
  customsIdRequired: boolean;
  agencyNotice?: Bilingual;
};

/**
 * Shipping/customs copy (STEP 13 spec sections 13-15) — bilingual per field,
 * same pattern as SHIPPING_METHOD_LABEL below, so a consumer picks
 * `field[locale]` instead of reading a single locale-blind string.
 */
export const SHIPPING_INFO: Record<ShippingType, ShippingInfoConfig> = {
  domestic: {
    title: { ko: "국내배송", en: "Domestic Shipping" },
    origin: { ko: "국내 재고 상품", en: "Shipped from domestic stock" },
    eta: { ko: "예상 도착 1~3일", en: "Estimated 1–3 days" },
    methodNote: { ko: "택배 배송", en: "Courier delivery" },
    defaultFee: { ko: "배송비 3,000원", en: "Shipping fee 3,000 KRW" },
    customsIdRequired: false,
  },
  overseas_direct: {
    title: { ko: "해외직배송", en: "International Direct Shipping" },
    origin: { ko: "해외 현지에서 직접 출고", en: "Shipped directly from overseas" },
    eta: { ko: "예상 배송 10~25일", en: "Estimated 10–25 days" },
    methodNote: { ko: "해상운송 기본 / 일부 항공 가능", en: "Sea freight by default; air available for some items" },
    defaultFee: { ko: "배송비 5,000원~ (상품 무게에 따라 상이)", en: "From 5,000 KRW (varies by item weight)" },
    customsIdRequired: false,
  },
  overseas_agent: {
    title: { ko: "해외구매대행", en: "Overseas Purchase Service" },
    origin: { ko: "주문 후 해외 구매가 진행됩니다", en: "Purchased overseas on your behalf after ordering" },
    eta: { ko: "예상 배송 10~25일", en: "Estimated 10–25 days" },
    methodNote: { ko: "개인통관고유부호 필요", en: "Personal customs clearance code required" },
    defaultFee: { ko: "구매대행 수수료 및 배송비 별도 안내", en: "Service fee and shipping quoted separately" },
    customsIdRequired: true,
    agencyNotice: {
      ko: "본 상품은 해외 구매대행 상품으로, 주문 접수 후 해외 판매처에서 상품을 구매하여 국내로 배송합니다. 통관 절차상 개인통관고유부호 입력이 필요하며, 상품 특성 및 현지 사정에 따라 배송기간이 변동될 수 있습니다.",
      en: "This is an overseas purchase-service item — after your order is placed, it is bought from an overseas seller and shipped to you. A personal customs clearance code is required, and delivery time may vary by item and local conditions.",
    },
  },
  direct_pickup: {
    title: { ko: "직접수령", en: "Store Pickup" },
    origin: { ko: "매장/지정 장소에서 직접 수령", en: "Picked up in person at the store or a designated location" },
    eta: { ko: "수령 준비 완료 후 방문 가능", en: "Ready for pickup once prepared" },
    methodNote: { ko: "택배 없이 방문 수령", en: "No courier — picked up in person" },
    defaultFee: { ko: "수령비 없음(무료)", en: "No pickup fee" },
    customsIdRequired: false,
  },
};

export const ORIGIN_COUNTRY: Record<ShippingType, Bilingual> = {
  domestic: { ko: "대한민국", en: "South Korea" },
  overseas_direct: { ko: "중국 등 해외", en: "China and other overseas origins" },
  overseas_agent: { ko: "해외 판매처별 상이", en: "Varies by overseas seller" },
  direct_pickup: { ko: "매장 수령", en: "Store pickup" },
};

/** Customer-facing label for the international transport mode — never show the raw SEA/AIR code. */
export const SHIPPING_METHOD_LABEL: Record<InternationalShippingMethod, Bilingual> = {
  SEA: { ko: "해외 일반배송", en: "Standard overseas shipping" },
  AIR: { ko: "해외 항공배송", en: "Air overseas shipping" },
};

export function pickLocale(value: Bilingual, locale: LocaleCode): string {
  return value[locale];
}
