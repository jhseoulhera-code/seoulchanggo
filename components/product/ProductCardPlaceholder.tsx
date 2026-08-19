export function ProductCardPlaceholder() {
  return (
    <div className="w-32 flex-shrink-0 md:w-40">
      <div className="aspect-square w-full rounded-md border border-border bg-primary-light" />
      <div className="mt-2 h-3 w-full rounded bg-border" />
      <div className="mt-1.5 h-3 w-2/3 rounded bg-border" />
    </div>
  );
}
