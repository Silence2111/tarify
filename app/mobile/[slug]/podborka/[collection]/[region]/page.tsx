import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import {
  findMobileOperator,
  getMobileOperatorRegions,
  getMobileRegionContext,
} from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionMetadata } from "@/lib/collection-meta";
import { findCollection } from "@/lib/collections";
import { regionBySlug, regionSlug } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; collection: string; region: string }> };

// /mobile/<оператор>/podborka/<подборка>/<регион> — подборка оператора с ценами региона,
// где у него свои цены. Как и у страниц «оператор + регион», других регионов нет.
async function resolve(slug: string, collectionSlug: string, regionParam: string) {
  const collection = findCollection(collectionSlug);
  const op = collection ? await findMobileOperator(slug) : null;
  if (!collection || !op) return null;
  const own = (await getMobileOperatorRegions()).get(op.slug) ?? [];
  return { op, collection, own, region: regionBySlug(regionParam, own) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, collection, region: regionParam } = await params;
  const found = await resolve(slug, collection, regionParam);
  if (!found?.region) return { title: "Подборка не найдена" };
  const { op, region } = found;
  return collectionMetadata(
    found.collection,
    region,
    `/mobile/${op.slug}/podborka/${found.collection.slug}/${regionSlug(region)}`,
    op,
  );
}

export default async function OperatorCollectionRegionPage({ params }: Props) {
  const { slug, collection, region: regionParam } = await params;
  const found = await resolve(slug, collection, regionParam);
  if (!found) notFound();
  const { op, own, region } = found;
  const base = `/mobile/${op.slug}/podborka/${found.collection.slug}`;
  if (!region) {
    // Регион есть в каталоге, но своих цен у оператора там нет — на подборку без региона.
    if (regionBySlug(regionParam, (await getMobileRegionContext()).regions)) permanentRedirect(base);
    notFound();
  }
  if (region === pickRegion(undefined, own)) permanentRedirect(base);
  return <MobileCatalog region={region} operator={op} collection={found.collection} />;
}
