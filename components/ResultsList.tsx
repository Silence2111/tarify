"use client";

import { useMemo, useState } from "react";
import type { ProviderGroup } from "@/lib/types";
import { PlanCard } from "./PlanCard";
import { plural } from "@/lib/format";

export function ResultsList({
  groups,
  addressText,
  buildingId,
}: {
  groups: ProviderGroup[];
  addressText: string;
  buildingId?: string;
}) {
  const [maxPrice, setMaxPrice] = useState<number>(0); // 0 = без ограничения
  const [minSpeed, setMinSpeed] = useState<number>(0);
  const [tvOnly, setTvOnly] = useState(false);
  const [sort, setSort] = useState<"price" | "speed">("price");

  const filtered = useMemo(() => {
    return groups
      .map((g) => {
        let plans = g.plans.filter((p) => {
          if (maxPrice && p.priceMonthly > maxPrice) return false;
          if (minSpeed && (p.speedMbps ?? 0) < minSpeed) return false;
          if (tvOnly && !p.hasTv) return false;
          return true;
        });
        plans = [...plans].sort((a, b) =>
          sort === "price"
            ? a.priceMonthly - b.priceMonthly
            : (b.speedMbps ?? 0) - (a.speedMbps ?? 0),
        );
        return { ...g, plans };
      })
      .filter((g) => g.plans.length > 0);
  }, [groups, maxPrice, minSpeed, tvOnly, sort]);

  const totalPlans = filtered.reduce((s, g) => s + g.plans.length, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-500">До</span>
          <input
            type="number"
            min={0}
            step={50}
            placeholder="₽/мес"
            value={maxPrice || ""}
            onChange={(e) => setMaxPrice(Number(e.target.value) || 0)}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-500">От</span>
          <input
            type="number"
            min={0}
            step={50}
            placeholder="Мбит/с"
            value={minSpeed || ""}
            onChange={(e) => setMinSpeed(Number(e.target.value) || 0)}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={tvOnly} onChange={(e) => setTvOnly(e.target.checked)} />
          <span className="text-slate-600">С ТВ</span>
        </label>
        <label className="ml-auto flex items-center gap-1.5">
          <span className="text-slate-500">Сортировка</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "price" | "speed")}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="price">по цене</option>
            <option value="speed">по скорости</option>
          </select>
        </label>
      </div>

      <p className="mb-3 text-sm text-slate-500">
        {filtered.length} {plural(filtered.length, "провайдер", "провайдера", "провайдеров")},{" "}
        {totalPlans} {plural(totalPlans, "тариф", "тарифа", "тарифов")}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          Под фильтры ничего не нашлось. Смягчите условия.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((g) => (
            <section key={g.providerId}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-800">{g.providerName}</h2>
                {g.techNote && <span className="text-xs text-slate-400">{g.techNote}</span>}
              </div>
              <div className="space-y-3">
                {g.plans.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    providerName={g.providerName}
                    addressText={addressText}
                    buildingId={buildingId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
