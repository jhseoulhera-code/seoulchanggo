type SectionHeadingProps = {
  title: string;
};

export function SectionHeading({ title }: SectionHeadingProps) {
  return (
    <h2 className="px-4 text-base font-bold text-text-main md:px-6 md:text-lg">
      {title}
    </h2>
  );
}
