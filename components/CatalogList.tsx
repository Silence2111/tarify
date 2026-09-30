"use client";

import { useMemo, useState } from "react";
import { filterCatalogPlans, NO_FILTERS, type CatalogFilters } from "@/lib/catalog-filter";
import { plural } from "@/lib/format";
import type { CatalogPlan } from "@/lib/types";
import { PlanCard } from "./PlanCard";

// Каталог тарифов общим списком: мобильная связь или счета для бизнеса.
// У мобильной связи фильтров больше (гигабайты, минуты, eSIM).
export function CatalogList({
  plans,
  kind,
  providers,
  actionLabel,
}: {
  plans: CatalogPlan[];
  kind: "mobile" | "business";
  providers: { slug: string; name: string }[];
  actionLabel?: string;
}) {
  const [f, setF] = useState<CatalogFilters>(NO_FILTERS);
  const set = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const shown = useMemo(() => filterCatalogPlans(plans, f), [plans, f]);
  const mobile = kind === "mobile";
  const who = mobile ? "Оператор" : "Банк";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-500">До</span>
          <input
            id="catalog-max-price"
            type="number"
            min={0}
            step={50}
            placeholder="₽/мес"
            value={f.maxPrice || ""}
            onChange={(e) => set("maxPrice", Number(e.target.value) || 0)}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        {mobile && (
          <>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-500">От</span>
              <input
                id="catalog-min-gb"
                type="number"
                min={0}
                step={5}
                placeholder="ГБ"
                value={f.minGb || ""}
                onChange={(e) => set("minGb", Number(e.target.value) || 0)}
                className="w-20 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-500">От</span>
              <input
                id="catalog-min-minutes"
                type="number"
                min={0}
                step={100}
                placeholder="минут"
                value={f.minMinutes || ""}
                onChange={(e) => set("minMinutes", Number(e.target.value) || 0)}
                className="w-24 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <input
                id="catalog-esim"
                type="checkbox"
                checked={f.esimOnly}
                onChange={(e) => set("esimOnly", e.target.checked)}
              />
              <span className="text-slate-600">eSIM</span>
            </label>
          </>
        )}
        {providers.length > 1 && (
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">{who}</span>
            <select
              id="catalog-provider"
              value={f.provider}
              onChange={(e) => set("provider", e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="">все</option>
              {providers.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {mobile && (
          <label className="ml-auto flex items-center gap-1.5">
            <span className="text-slate-500">Сортировка</span>
            <select
              id="catalog-sort"
              value={f.sort}
              onChange={(e) => set("sort", e.target.value as CatalogFilters["sort"])}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="price">по цене</option>
              <option value="gb">по гигабайтам</option>
            </select>
          </label>
        )}
      </div>

      <p className="mb-3 text-sm text-slate-500">
        {shown.length} {plural(shown.length, "тариф", "тарифа", "тарифов")}
      </p>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          Под фильтры ничего не нашлось. Смягчите условия.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              providerName={p.providerName}
              addressText={p.region ?? "вся Россия"}
              eyebrow={p.providerName}
              actionLabel={actionLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
