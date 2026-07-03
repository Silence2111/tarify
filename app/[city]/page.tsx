import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCityProviders } from "@/lib/coverage";
import { AddressSearch } from "@/components/AddressSearch";
import { PlanCard } from "@/components/PlanCard";
import { plural } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }> };

// Гео-SEO: отдельная страница под каждый город — органический трафик
// по запросам «интернет-провайдеры <город>».
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const data = await getCityProviders(city);
  if (!data) return { title: "Город не найден" };
  return {
    title: `Интернет-провайдеры в ${data.city.name}`,
    description: `Тарифы на домашний интернет и ТВ в ${data.city.name}: ${data.groups.length} провайдеров. Сравните и подключите бесплатно.`,
  };
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  const data = await getCityProviders(city);
  if (!data) notFound();

  const { city: cityRow, groups } = data;

  const streets = await prisma.street.findMany({
    where: { cityId: cityRow.id },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        / {cityRow.name}
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        Интернет-провайдеры в {cityRow.name}
      </h1>
      <p className="mt-1 text-slate-500">
        {groups.length} {plural(groups.length, "провайдер", "провайдера", "провайдеров")} с тарифами.
        Проверьте, что доступно по вашему адресу:
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <AddressSearch cities={[{ id: cityRow.id, slug: cityRow.slug, name: cityRow.name }]} />
      </div>

      {streets.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Улицы</h2>
          <div className="flex flex-wrap gap-2">
            {streets.map((s) => (
              <Link
                key={s.slug}
                href={`/${cityRow.slug}/${s.slug}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-brand hover:border-brand"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <section key={g.providerId}>
            <h2 className="mb-2 font-semibold text-slate-800">{g.providerName}</h2>
            <div className="space-y-3">
              {g.plans.map((p) => (
                <PlanCard key={p.id} plan={p} providerName={g.providerName} addressText={cityRow.name} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
