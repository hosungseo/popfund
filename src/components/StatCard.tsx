interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: Props) {
  return (
    <div
      className={`rounded-2xl p-6 flex flex-col gap-1 ${
        accent
          ? "bg-[#0B4171] text-white shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]"
          : "bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]"
      }`}
    >
      <span
        className={`text-xs font-medium uppercase tracking-widest ${
          accent ? "text-blue-200" : "text-slate-500"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums leading-tight break-keep ${
          accent ? "text-white" : "text-slate-900"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span
          className={`text-xs ${accent ? "text-blue-200" : "text-slate-500"}`}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
