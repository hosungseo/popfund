import type { Region } from "@/lib/types";

interface Props {
  type: Region["type"];
  size?: "sm" | "md";
}

export default function RegionBadge({ type, size = "md" }: Props) {
  const isDecrease = type === "감소";
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide ${sizeClass} ${
        isDecrease
          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      }`}
    >
      {type}지역
    </span>
  );
}
