import { ChevronRight } from "lucide-react";

type SectionHeadingProps = {
  title: string;
  showMore?: boolean;
};

export function SectionHeading({ title, showMore }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold text-text-main md:text-lg">{title}</h2>
      {showMore && (
        <button
          type="button"
          className="flex cursor-not-allowed items-center gap-0.5 text-xs text-text-secondary"
        >
          더보기
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
