import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findCoverageByAddress } from "@/lib/coverage";
import { ResultsList } from "@/components/ResultsList";

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
        <p className="text-slate-500">Укажите улицу для поиска.</p>
      </div>
    );
  }

  const result = await findCoverageByAddress(city, street, house);

  return (
    <div>
      <Back city={city} cityName={cityRow.name} />
      <h1 className="text-2xl font-bold text-slate-900">Тарифы по адресу</h1>
      <p className="mt-1 text-slate-500">{result.addressText}</p>
      {result.matched === "street" && house && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Точного дома нет в базе — показываем провайдеров по улице. Уточним при звонке.
        </p>
      )}

      <div className="mt-6">
        {result.groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            По этому адресу провайдеров в базе пока нет. Оставьте заявку на главной — подберём вручную.
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
    <div className="mb-4 text-sm text-slate-500">
      <Link href="/" className="hover:text-brand">
        Главная
      </Link>{" "}
      /{" "}
      <Link href={`/${city}`} className="hover:text-brand">
        {cityName}
      </Link>
    </div>
  );
}
