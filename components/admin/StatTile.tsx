type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 border border-border p-4">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xl font-bold text-text-main">{value}</span>
    </div>
  );
}
