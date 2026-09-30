"use client";

import { useRouter } from "next/navigation";

// Выбор региона цен: мобильные тарифы в каждом регионе стоят по-своему. У каждого
// региона свой адрес (/mobile/tatarstan) — страница, которую видит и поиск.
export function RegionSelect({
  options,
  current,
}: {
  options: { name: string; href: string }[];
  current: string | null;
}) {
  const router = useRouter();
  if (options.length === 0) return null;

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Цены для региона</span>
      <select
        id="region-select"
        value={current ?? ""}
        onChange={(e) => {
          const next = options.find((o) => o.name === e.target.value);
          if (next) router.push(next.href);
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
