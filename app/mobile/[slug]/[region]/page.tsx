import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import {
  findMobileOperator,
  getMobileOperatorRegions,
  getMobileRegionContext,
} from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { regionBySlug, regionSlug } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; region: string }> };

// /mobile/<оператор>/<регион>: тарифы оператора с ценами региона — под запросы
// «тарифы МТС Татарстан». Страница есть, только если у оператора в регионе свои цены.
async function resolve(slug: string, regionParam: string) {
  const op = await findMobileOperator(slug);
  if (!op) return null;
  const own = (await getMobileOperatorRegions()).get(op.slug) ?? [];
  return { op, own, region: regionBySlug(regionParam, own) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, region: regionParam } = await params;
  const found = await resolve(slug, regionParam);
  if (!found?.region) return { title: "Страница не найдена" };
  const { op, region } = found;
  return {
    title: `Тарифы ${op.name} — ${region}`,
    description: `Тарифы ${op.name} с ценами для региона ${region}: гигабайты, минуты, eSIM. Сравните и оформите онлайн.`,
    alternates: { canonical: `/mobile/${op.slug}/${regionSlug(region)}` },
  };
}

export default async function OperatorRegionPage({ params }: Props) {
  const { slug, region: regionParam } = await params;
  const found = await resolve(slug, regionParam);
  if (!found) notFound();
  const { op, own, region } = found;
  if (!region) {
    // Регион есть в каталоге, но своих цен у оператора там нет — его тарифы с единой
    // ценой на странице оператора.
    if (regionBySlug(regionParam, (await getMobileRegionContext()).regions)) {
      permanentRedirect(`/mobile/${op.slug}`);
    }
    notFound();
  }
  if (region === pickRegion(undefined, own)) permanentRedirect(`/mobile/${op.slug}`);
  return <MobileCatalog region={region} operator={op} />;
}
