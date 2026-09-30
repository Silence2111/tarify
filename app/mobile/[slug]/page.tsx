import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import {
  findMobileOperator,
  getMobileOperatorRegions,
  getMobileRegionContext,
} from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { operatorPath, regionBySlug, regionSlug } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ region?: string }>;
};

// /mobile/<оператор> — тарифы оператора в его регионе по умолчанию;
// /mobile/<регион> — все операторы в регионе. Слаги операторов и регионов не пересекаются,
// а если совпадут — страница оператора важнее.

// SEO под запросы «тарифы <оператор>» и «тарифы мобильной связи <регион>».
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const op = await findMobileOperator(slug);
  if (op) {
    return {
      title: `Тарифы ${op.name}`,
      description: `Все тарифы ${op.name} с ценами вашего региона: гигабайты, минуты, eSIM. Сравните и оформите онлайн.`,
      alternates: { canonical: `/mobile/${op.slug}` },
    };
  }
  const region = regionBySlug(slug, (await getMobileRegionContext()).regions);
  if (!region) return { title: "Страница не найдена" };
  return {
    title: `Тарифы мобильной связи — ${region}`,
    description: `Тарифы операторов с ценами для региона ${region}: гигабайты, минуты, eSIM, перенос номера. Сравните и оформите онлайн.`,
    alternates: { canonical: `/mobile/${regionSlug(region)}` },
  };
}

export default async function MobileSlugPage({ params, searchParams }: Props) {
  const [{ slug }, { region: legacy }] = await Promise.all([params, searchParams]);
  const op = await findMobileOperator(slug);

  if (op) {
    const own = (await getMobileOperatorRegions()).get(op.slug) ?? [];
    // Старые ссылки ?region= — на адрес с регионом в пути.
    if (legacy !== undefined) permanentRedirect(operatorPath(op.slug, legacy, own));
    // Без своих цен в регионах (единая цена по России) региона у страницы нет.
    return <MobileCatalog region={pickRegion(undefined, own)} operator={op} />;
  }

  const { regions, defaultRegion } = await getMobileRegionContext();
  const region = regionBySlug(slug, regions);
  if (!region) notFound();
  if (region === defaultRegion) permanentRedirect("/mobile");
  return <MobileCatalog region={region} />;
}
