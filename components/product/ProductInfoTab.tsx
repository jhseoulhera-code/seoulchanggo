import { categories } from "@/data/categories";
import { ORIGIN_COUNTRY } from "@/data/shippingInfo";
import type { Product, ProductSpec } from "@/types";

type ProductInfoTabProps = {
  product: Product;
};

function getFallbackSpecs(product: Product): ProductSpec[] {
  const categoryLabel =
    categories.find((item) => item.id === product.category)?.label ?? "일반상품";

  return [
    { label: "카테고리", value: categoryLabel },
    { label: "배송방식", value: product.shippingLabel },
    { label: "구성품", value: "상품 1개, 사용 안내서" },
    { label: "제조국/원산지", value: ORIGIN_COUNTRY[product.shippingType] },
  ];
}

export function ProductInfoTab({ product }: ProductInfoTabProps) {
  const description =
    product.description ??
    `${product.name}의 상세 정보입니다. 실사용 환경에 맞춰 꼼꼼하게 준비된 상품이며, 옵션 및 배송 방식은 상단 정보를 참고해주세요.`;
  const specs = product.specifications ?? getFallbackSpecs(product);

  return (
    <div className="flex flex-col gap-8 py-5">
      <section>
        <h3 className="mb-2 text-sm font-bold text-text-main">상품 설명</h3>
        <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-text-main">주요 특징</h3>
        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
          <li>· 꼼꼼한 검수를 거쳐 발송되는 상품입니다.</li>
          <li>· 배송 방식에 따라 예상 도착 기간이 상이할 수 있습니다.</li>
          <li>· 옵션에 따라 실제 상품 이미지와 차이가 있을 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-text-main">상세 스펙</h3>
        <dl className="flex flex-col">
          {specs.map((spec) => (
            <div
              key={spec.label}
              className="flex gap-4 border-t border-border py-2.5 text-sm first:border-t-0"
            >
              <dt className="w-24 flex-shrink-0 text-text-secondary">{spec.label}</dt>
              <dd className="text-text-main">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-text-main">주의사항</h3>
        <p className="text-xs leading-relaxed text-text-secondary">
          상품 이미지는 촬영 환경에 따라 실제 색상과 다소 차이가 있을 수 있습니다. 배송지연,
          상품 하자 등 문의사항은 상품문의 또는 고객센터를 통해 접수해주세요.
        </p>
      </section>
    </div>
  );
}
