import Image from "next/image";
import type { ProductDetailBlock } from "@/types";

type ProductDetailBlocksProps = {
  blocks: ProductDetailBlock[];
};

/**
 * STEP 26.7 — a pure renderer for ProductDetailBlock[] (types/index.ts).
 * Every current caller builds this array from real, already-existing data
 * (description text, the generic feature-notice strings, the structured
 * spec table) — this component itself has no opinion on where the blocks
 * came from, which is what makes it ready to render real admin-authored
 * blocks later without changing.
 */
export function ProductDetailBlocks({ blocks }: ProductDetailBlocksProps) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h3 key={index} className="text-sm font-bold text-text-main">
                {block.text}
              </h3>
            );
          case "paragraph":
            return (
              <p key={index} className="text-sm leading-relaxed text-text-secondary">
                {block.text}
              </p>
            );
          case "image":
            return (
              <div key={index} className="relative aspect-[4/3] w-full overflow-hidden">
                <Image src={block.url} alt={block.alt} fill sizes="(min-width: 768px) 62vw, 100vw" loading="lazy" className="object-cover" />
              </div>
            );
          case "imageGrid":
            return (
              <div key={index} className="grid grid-cols-2 gap-2">
                {block.images.map((image, imageIndex) => (
                  <div key={imageIndex} className="relative aspect-square overflow-hidden">
                    <Image src={image.url} alt={image.alt} fill sizes="(min-width: 768px) 31vw, 50vw" loading="lazy" className="object-cover" />
                  </div>
                ))}
              </div>
            );
          case "featureList":
            return (
              <ul key={index} className="flex flex-col gap-2 text-sm text-text-secondary">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>· {item}</li>
                ))}
              </ul>
            );
          case "specTable":
            return (
              <dl key={index} className="flex flex-col">
                {block.rows.map((row) => (
                  <div key={row.label} className="flex gap-4 border-t border-border py-2.5 text-sm first:border-t-0">
                    <dt className="w-24 flex-shrink-0 text-text-secondary">{row.label}</dt>
                    <dd className="text-text-main">{row.value}</dd>
                  </div>
                ))}
              </dl>
            );
          case "divider":
            return <hr key={index} className="border-border" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
