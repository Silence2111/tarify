"use client";

import { useMemo, useState } from "react";
import type { ProviderGroup } from "@/lib/types";
import { PlanCard } from "./PlanCard";
import { plural, techLabel } from "@/lib/format";

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

  const reset = () => { setMaxPrice(0); setMinSpeed(0); setTvOnly(false); };

  return (
    <div>
      <div className="card mb-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end">
        <div>
          <label htmlFor="f-price" className="label">Цена до, ₽ в месяц</label>
          <input id="f-price" type="number" inputMode="numeric" min={0} step={50} placeholder="например, 800"
            value={maxPrice || ""} onChange={(e) => setMaxPrice(Number(e.target.value) || 0)} className="field" />
        </div>
        <div>
          <label htmlFor="f-speed" className="label">Скорость от, Мбит/с</label>
          <input id="f-speed" type="number" inputMode="numeric" min={0} step={50} placeholder="например, 200"
            value={minSpeed || ""} onChange={(e) => setMinSpeed(Number(e.target.value) || 0)} className="field" />
        </div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 text-ink">
          <input type="checkbox" checked={tvOnly} onChange={(e) => setTvOnly(e.target.checked)} className="h-5 w-5 accent-brand" />
          С телевидением
        </label>
        <div>
          <label htmlFor="f-sort" className="label">Сортировка</label>
          <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as "price" | "speed")} className="field">
            <option value="price">сначала дешевле</option>
            <option value="speed">сначала быстрее</option>
          </select>
        </div>
      </div>

      <p className="mb-4 text-ink-2">
        {filtered.length} {plural(filtered.length, "провайдер", "провайдера", "провайдеров")},{" "}
        {totalPlans} {plural(totalPlans, "тариф", "тарифа", "тарифов")}
      </p>

      {filtered.length === 0 ? (
        <div className="card text-center">
          <p className="font-medium text-ink">Под эти условия тарифов нет</p>
          <p className="mt-1 text-ink-2">Поднимите цену или снизьте скорость.</p>
          <button type="button" onClick={reset} className="btn-soft mt-4">Сбросить фильтры</button>
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map((g) => (
            <section key={g.providerId}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold text-ink">{g.providerName}</h2>
                {g.techNote && <span className="text-sm text-ink-2">{techLabel(g.techNote)}</span>}
              </div>
              <div className="space-y-4">
                {g.plans.map((p) => (
                  <PlanCard key={p.id} plan={p} providerName={g.providerName} addressText={addressText} buildingId={buildingId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
