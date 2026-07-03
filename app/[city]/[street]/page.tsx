import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStreetProviders } from "@/lib/coverage";
import { PlanCard } from "@/components/PlanCard";
import { plural } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string; street: string }> };

// Гео-SEO под низкочастотные запросы «провайдеры на улице … в городе …».
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, street } = await params;
  const data = await getStreetProviders(city, street);
  if (!data) return { title: "Улица не найдена" };
  const title = `Интернет-провайдеры на ${data.street.name} (${data.city.name})`;
  return {
    title,
    description: `Тарифы на домашний интернет и ТВ на ${data.street.name} в ${data.city.name}: ${data.groups.length} провайдеров. Сравните и подключите бесплатно.`,
    alternates: { canonical: `/${city}/${street}` },
    openGraph: { title, type: "website" },
  };
}

export default async function StreetPage({ params }: Props) {
  const { city, street } = await params;
  const data = await getStreetProviders(city, street);
  if (!data) notFound();

  const { city: cityRow, street: streetRow, groups, buildingCount } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Интернет-провайдеры на ${streetRow.name}, ${cityRow.name}`,
    numberOfItems: groups.length,
    itemListElement: groups.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.providerName,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        /{" "}
        <Link href={`/${city}`} className="hover:text-brand">
          {cityRow.name}
        </Link>{" "}
        / {streetRow.name}
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        Интернет-провайдеры на {streetRow.name}
      </h1>
      <p className="mt-1 text-slate-500">
        {cityRow.name}. {groups.length}{" "}
        {plural(groups.length, "провайдер", "провайдера", "провайдеров")} на{" "}
        {buildingCount} {plural(buildingCount, "доме", "домах", "домах")}. Уточните точный адрес,
        чтобы увидеть, что доступно в вашем доме:
      </p>

      <div className="mt-4">
        <Link
          href={`/${city}/search?street=${encodeURIComponent(streetRow.name)}`}
          className="inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Проверить по номеру дома
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          По этой улице провайдеров в базе пока нет.
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {groups.map((g) => (
            <section key={g.providerId}>
              <h2 className="mb-2 font-semibold text-slate-800">{g.providerName}</h2>
              <div className="space-y-3">
                {g.plans.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    providerName={g.providerName}
                    addressText={`${cityRow.name}, ${streetRow.name}`}
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
