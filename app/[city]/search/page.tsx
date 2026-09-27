import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findCoverageByAddress } from "@/lib/coverage";
import { ResultsList } from "@/components/ResultsList";
import { AddressSearch } from "@/components/AddressSearch";
import { LeadForm } from "@/components/LeadForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ street?: string; house?: string }>;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const { city } = await params;
  const { street, house } = await searchParams;

  const cityRow = await prisma.city.findUnique({ where: { slug: city } });
  if (!cityRow) notFound();

  if (!street) {
    return (
      <div>
        <Back city={city} cityName={cityRow.name} />
        <h1 className="text-3xl font-semibold text-ink">Проверить адрес</h1>
        <div className="card mt-6">
          <AddressSearch cities={[{ id: cityRow.id, slug: cityRow.slug, name: cityRow.name }]} />
        </div>
      </div>
    );
  }

  const result = await findCoverageByAddress(city, street, house);

  return (
    <div>
      <Back city={city} cityName={cityRow.name} />
      <h1 className="text-3xl font-semibold text-ink">Тарифы по адресу</h1>
      <p className="mt-2 text-lg text-ink-2">{result.addressText}</p>
      {result.matched === "street" && house && (
        <p className="mt-4 rounded-md2 bg-warn-bg px-4 py-3 text-warn" role="note">
          Дома {house} нет в базе — показываем провайдеров по всей улице. В ваш дом может заходить
          не каждый из них: уточним при звонке.
        </p>
      )}

      <div className="mt-6">
        {result.groups.length === 0 ? (
          <div className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-start">
              <div>
                <h2 className="text-xl font-semibold text-ink">Этого адреса пока нет в базе</h2>
                <p className="mt-2 text-ink-2">
                  В демо-базе только несколько улиц Казани. Оставьте телефон — проверим адрес
                  вручную и перезвоним с вариантами.
                </p>
              </div>
              <div className="card">
                <LeadForm addressText={result.addressText + (house ? `, д. ${house}` : "")} startOpen submitText="Подобрать вручную" />
              </div>
            </div>
            <div className="card">
              <h2 className="mb-4 text-lg font-semibold text-ink">Или проверьте другой адрес</h2>
              <AddressSearch cities={[{ id: cityRow.id, slug: cityRow.slug, name: cityRow.name }]} />
            </div>
          </div>
        ) : (
          <ResultsList
            groups={result.groups}
            addressText={result.addressText}
            buildingId={result.buildingId}
          />
        )}
      </div>
    </div>
  );
}

function Back({ city, cityName }: { city: string; cityName: string }) {
  return (
    <div className="crumbs mb-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
      <Link href="/" className="">
        Главная
      </Link>{" "}
      /{" "}
      <Link href={`/${city}`} className="">
        {cityName}
      </Link>
    </div>
  );
}
