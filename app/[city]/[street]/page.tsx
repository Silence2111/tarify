import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStreetProviders } from "@/lib/coverage";
import { prisma } from "@/lib/db";
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
  const houses = await prisma.building.findMany({
    where: { street: { slug: street, city: { slug: city } } },
    select: { house: true },
  });
  houses.sort((a, b) => a.house.localeCompare(b.house, "ru", { numeric: true }));

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

      <div className="crumbs mb-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
        <Link href="/" className="">
          Главная
        </Link>{" "}
        /{" "}
        <Link href={`/${city}`} className="">
          {cityRow.name}
        </Link>{" "}
        / {streetRow.name}
      </div>

      <h1 className="text-3xl font-semibold text-ink">
        Интернет-провайдеры на {streetRow.name}
      </h1>
      <p className="mt-2 text-lg text-ink-2">
        {cityRow.name}. {groups.length}{" "}
        {plural(groups.length, "провайдер", "провайдера", "провайдеров")} на{" "}
        {buildingCount} {plural(buildingCount, "доме", "домах", "домах")}. Выберите дом —
        покажем, кто заходит именно в него.
      </p>

      {houses.length > 0 && (
        <div className="mt-6">
          <p className="label">Выберите дом</p>
          <div className="flex flex-wrap gap-2">
            {houses.map((h) => (
              <Link
                key={h.house}
                href={`/${city}/search?street=${encodeURIComponent(streetRow.name)}&house=${encodeURIComponent(h.house)}`}
                className="chip min-w-[56px] justify-center"
              >
                {h.house}
              </Link>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card mt-8 text-center text-ink-2">
          По этой улице провайдеров в базе пока нет.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <section key={g.providerId}>
              <h2 className="mb-3 text-xl font-semibold text-ink">{g.providerName}</h2>
              <div className="space-y-4">
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
