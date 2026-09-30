import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import { getMobileRegionContext } from "@/lib/catalog";
import { collectionMetadata } from "@/lib/collection-meta";
import { findCollection } from "@/lib/collections";
import { catalogPath } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ region?: string }>;
};

// SEO под запросы «тарифы с безлимитным интернетом», «без абонентской платы» и т. п.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = findCollection(slug);
  if (!collection) return { title: "Подборка не найдена" };
  const { defaultRegion } = await getMobileRegionContext();
  return collectionMetadata(collection, defaultRegion, `/mobile/podborka/${collection.slug}`);
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, { region: legacy }] = await Promise.all([params, searchParams]);
  const collection = findCollection(slug);
  if (!collection) notFound();
  const { regions, defaultRegion } = await getMobileRegionContext();
  // Старые ссылки ?region= — на адрес с регионом в пути.
  if (legacy !== undefined) {
    permanentRedirect(
      catalogPath(`/mobile/podborka/${collection.slug}`, regions.includes(legacy) ? legacy : null, defaultRegion),
    );
  }
  return <MobileCatalog region={defaultRegion} collection={collection} />;
}
