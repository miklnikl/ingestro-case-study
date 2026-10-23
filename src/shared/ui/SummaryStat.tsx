export function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
