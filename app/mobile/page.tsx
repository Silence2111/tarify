import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import { getMobileRegionContext } from "@/lib/catalog";
import { catalogPath } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ region?: string }> };

// Регион по умолчанию — в заголовке, как и в h1: цены на странице — его.
export async function generateMetadata(): Promise<Metadata> {
  const { defaultRegion } = await getMobileRegionContext();
  return {
    title: `Тарифы мобильной связи${defaultRegion ? ` — ${defaultRegion}` : ""}`,
    description:
      "Сравните тарифы МТС, Билайна, МегаФона, t2 и других операторов в вашем регионе: гигабайты, минуты, цена, eSIM и перенос номера.",
    alternates: { canonical: "/mobile" },
  };
}

export default async function MobilePage({ searchParams }: Props) {
  const [{ region: legacy }, { regions, defaultRegion }] = await Promise.all([
    searchParams,
    getMobileRegionContext(),
  ]);
  // Старые ссылки ?region= — на адрес с регионом в пути.
  if (legacy !== undefined) {
    permanentRedirect(catalogPath("/mobile", regions.includes(legacy) ? legacy : null, defaultRegion));
  }
  return <MobileCatalog region={defaultRegion} />;
}
