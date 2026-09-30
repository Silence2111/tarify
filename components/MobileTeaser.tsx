import Link from "next/link";
import { getCatalogPlans } from "@/lib/catalog";
import { PlanCard } from "./PlanCard";

// Мобильная связь рядом с интернетом по адресу: три самых дешёвых тарифа региона
// и ссылка на весь каталог. Нет региона или тарифов — блока нет.
export async function MobileTeaser({
  region,
  addressText,
  title = "Мобильная связь: самые доступные тарифы",
}: {
  region: string | null;
  addressText: string;
  title?: string;
}) {
  if (!region) return null;
  const plans = await getCatalogPlans("MOBILE", { region, take: 3 });
  if (plans.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href={`/mobile/podbor?region=${encodeURIComponent(region)}`}
            className="text-brand hover:underline"
          >
            Подобрать под свой расход
          </Link>
          <Link
            href={`/mobile?region=${encodeURIComponent(region)}`}
            className="text-brand hover:underline"
          >
            Все тарифы региона →
          </Link>
        </div>
      </div>
      <div className="space-y-3">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            providerName={p.providerName}
            addressText={addressText}
            eyebrow={p.providerName}
          />
        ))}
      </div>
    </section>
  );
}
