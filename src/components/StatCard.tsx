interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: Props) {
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-1 ${
        accent
          ? "bg-stone-900 border-stone-800 text-white"
          : "bg-white border-stone-200"
      }`}
    >
      <span
        className={`text-xs font-medium uppercase tracking-widest ${
          accent ? "text-stone-400" : "text-stone-500"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-3xl font-bold tabular-nums leading-tight ${
          accent ? "text-white" : "text-stone-900"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span
          className={`text-xs ${accent ? "text-stone-400" : "text-stone-500"}`}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
