"use client";

import { useRouter } from "next/navigation";

// Выбор региона цен: мобильные тарифы в каждом регионе стоят по-своему.
export function RegionSelect({
  regions,
  current,
  basePath,
}: {
  regions: string[];
  current: string | null;
  basePath: string;
}) {
  const router = useRouter();
  if (regions.length === 0) return null;

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Цены для региона</span>
      <select
        id="region-select"
        value={current ?? ""}
        onChange={(e) => router.push(`${basePath}?region=${encodeURIComponent(e.target.value)}`)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
