import { SHIPPING_INFO } from "@/data/shippingInfo";
import type { Product } from "@/types";

type ShippingExchangeTabProps = {
  product: Product;
};

export function ShippingExchangeTab({ product }: ShippingExchangeTabProps) {
  const info = SHIPPING_INFO[product.shippingType];
  const feeLine = product.freeShipping ? "무료배송" : info.defaultFee;

  const rows = [
    { label: "배송방식", value: `${info.title} · ${info.methodNote}` },
    { label: "배송기간", value: info.eta },
    { label: "배송비", value: feeLine },
    { label: "교환 조건", value: "상품 수령 후 7일 이내, 미사용 상품에 한해 교환 가능합니다." },
    { label: "반품 조건", value: "상품 수령 후 7일 이내 신청 가능하며, 왕복 배송비는 사유에 따라 상이합니다." },
  ];

  return (
    <div className="flex flex-col py-5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-4 border-t border-border py-3 first:border-t-0">
          <span className="w-20 flex-shrink-0 text-text-secondary">{row.label}</span>
          <span className="text-text-main">{row.value}</span>
        </div>
      ))}

      {product.shippingType === "overseas_direct" && (
        <div className="border-t border-border py-3">
          <p className="mb-1 text-xs font-bold text-text-secondary">해외직배송 주의사항</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            해외 현지에서 직접 출고되는 상품으로 통관 절차에 따라 배송이 지연될 수 있으며, 관세가
            발생할 수 있습니다. 단순 변심에 의한 반품 시 왕복 국제배송비가 발생합니다.
          </p>
        </div>
      )}

      {product.shippingType === "overseas_agent" && (
        <div className="border-t border-border py-3">
          <p className="mb-1 text-xs font-bold text-text-secondary">해외구매대행 주의사항</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            {info.agencyNotice} 통관 시 개인통관고유부호가 필요하며, 주문 확정 후에는 현지 발주
            특성상 취소·변경이 제한될 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
