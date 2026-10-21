import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import { findMobileOperator, getMobileOperatorRegions } from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionMetadata } from "@/lib/collection-meta";
import { findCollection } from "@/lib/collections";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; collection: string }> };

// /mobile/<оператор>/podborka/<подборка> — «безлимитные тарифы МТС», «самые дешёвые
// тарифы Билайн» — с ценами региона оператора по умолчанию. Другой регион —
// /mobile/<оператор>/podborka/<подборка>/<регион>.
async function resolve(slug: string, collectionSlug: string) {
  const collection = findCollection(collectionSlug);
  const op = collection ? await findMobileOperator(slug) : null;
  if (!collection || !op) return null;
  const own = (await getMobileOperatorRegions()).get(op.slug) ?? [];
  return { op, collection, region: pickRegion(undefined, own) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, collection } = await params;
  const found = await resolve(slug, collection);
  if (!found) return { title: "Подборка не найдена" };
  const { op, region } = found;
  return collectionMetadata(found.collection, region, `/mobile/${op.slug}/podborka/${found.collection.slug}`, op);
}

export default async function OperatorCollectionPage({ params }: Props) {
  const { slug, collection } = await params;
  const found = await resolve(slug, collection);
  if (!found) notFound();
  return <MobileCatalog region={found.region} operator={found.op} collection={found.collection} />;
}
