import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import { getMobileRegionContext } from "@/lib/catalog";
import { collectionMetadata } from "@/lib/collection-meta";
import { findCollection } from "@/lib/collections";
import { regionBySlug, regionSlug } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; region: string }> };

// /mobile/podborka/<подборка>/<регион> — «безлимитный интернет Татарстан» и т. п.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, region: regionParam } = await params;
  const collection = findCollection(slug);
  const region = regionBySlug(regionParam, (await getMobileRegionContext()).regions);
  if (!collection || !region) return { title: "Подборка не найдена" };
  return collectionMetadata(
    collection,
    region,
    `/mobile/podborka/${collection.slug}/${regionSlug(region)}`,
  );
}

export default async function CollectionRegionPage({ params }: Props) {
  const { slug, region: regionParam } = await params;
  const collection = findCollection(slug);
  const { regions, defaultRegion } = await getMobileRegionContext();
  const region = regionBySlug(regionParam, regions);
  if (!collection || !region) notFound();
  if (region === defaultRegion) permanentRedirect(`/mobile/podborka/${collection.slug}`);
  return <MobileCatalog region={region} collection={collection} />;
}
