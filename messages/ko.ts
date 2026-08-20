import type { Messages } from "@/messages";

export const ko: Messages = {
  common: {
    continueShopping: "쇼핑 계속하기",
    backToHome: "홈으로",
  },
  market: {
    selectorTitle: "국가 선택",
    change: "변경",
  },
  toast: {
    addedToCart: "장바구니에 상품을 담았습니다.",
    viewCart: "장바구니 보기",
    optionRequired: "옵션을 선택해주세요.",
    outOfStock: "재고 수량을 초과했습니다.",
  },
  product: {
    outOfMarketShort: "배송 불가",
  },
  cart: {
    title: "장바구니",
    empty: "장바구니에 담긴 상품이 없습니다.",
    selectAll: "전체선택",
    itemCount: "총 {count}개",
    groupDomestic: "국내배송",
    groupOverseasDirect: "해외직배송",
    groupOverseasAgency: "해외구매대행",
    remove: "삭제",
    unavailableInMarket: "현재 {country}로 배송할 수 없습니다.",
    itemsTotal: "상품금액",
    discountTotal: "상품할인",
    shippingTotal: "배송비",
    grandTotal: "결제예정금액",
    checkoutButton: "선택상품 구매하기 ({count})",
    checkoutPlaceholder: "주문 단계는 다음 STEP에서 연결됩니다.",
  },
};
