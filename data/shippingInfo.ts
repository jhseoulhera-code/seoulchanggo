import type { ShippingType } from "@/types";
import type { InternationalShippingMethod } from "@/types/market";

export type ShippingInfoConfig = {
  title: string;
  origin: string;
  eta: string;
  methodNote: string;
  defaultFee: string;
  customsIdRequired: boolean;
  agencyNotice?: string;
};

export const SHIPPING_INFO: Record<ShippingType, ShippingInfoConfig> = {
  domestic: {
    title: "국내배송",
    origin: "국내 재고 상품",
    eta: "예상 도착 1~3일",
    methodNote: "택배 배송",
    defaultFee: "배송비 3,000원",
    customsIdRequired: false,
  },
  overseas_direct: {
    title: "해외직배송",
    origin: "해외 현지에서 직접 출고",
    eta: "예상 배송 10~25일",
    methodNote: "해상운송 기본 / 일부 항공 가능",
    defaultFee: "배송비 5,000원~ (상품 무게에 따라 상이)",
    customsIdRequired: false,
  },
  overseas_agent: {
    title: "해외구매대행",
    origin: "주문 후 해외 구매가 진행됩니다",
    eta: "예상 배송 10~25일",
    methodNote: "개인통관고유부호 필요",
    defaultFee: "구매대행 수수료 및 배송비 별도 안내",
    customsIdRequired: true,
    agencyNotice:
      "본 상품은 해외 구매대행 상품으로, 주문 접수 후 해외 판매처에서 상품을 구매하여 국내로 배송합니다. 통관 절차상 개인통관고유부호 입력이 필요하며, 상품 특성 및 현지 사정에 따라 배송기간이 변동될 수 있습니다.",
  },
};

export const ORIGIN_COUNTRY: Record<ShippingType, string> = {
  domestic: "대한민국",
  overseas_direct: "중국 등 해외",
  overseas_agent: "해외 판매처별 상이",
};

/** Customer-facing label for the international transport mode — never show the raw SEA/AIR code. */
export const SHIPPING_METHOD_LABEL: Record<InternationalShippingMethod, { ko: string; en: string }> = {
  SEA: { ko: "해외 일반배송", en: "Standard overseas shipping" },
  AIR: { ko: "해외 항공배송", en: "Air overseas shipping" },
};
