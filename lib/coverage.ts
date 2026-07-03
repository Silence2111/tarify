import { prisma } from "@/lib/db";
import type { PlanView, ProviderGroup } from "@/lib/types";

function toPlanView(p: {
  id: string;
  name: string;
  type: string;
  speedMbps: number | null;
  priceMonthly: number;
  priceFirst: number | null;
  hasTv: boolean;
  tvChannels: number | null;
  hasMobile: boolean;
  mobileGb: number | null;
  description: string | null;
  options: { label: string; value: string }[];
}): PlanView {
  return {
    id: p.id,
    name: p.name,
    type: p.type as PlanView["type"],
    speedMbps: p.speedMbps,
    priceMonthly: p.priceMonthly,
    priceFirst: p.priceFirst,
    hasTv: p.hasTv,
    tvChannels: p.tvChannels,
    hasMobile: p.hasMobile,
    mobileGb: p.mobileGb,
    description: p.description,
    options: p.options.map((o) => ({ label: o.label, value: o.value })),
  };
}

export type CoverageResult = {
  matched: "building" | "street" | "none";
  addressText: string;
  buildingId?: string;
  groups: ProviderGroup[];
};

// Главный запрос продукта: какие провайдеры доступны по адресу.
export async function findCoverageByAddress(
  citySlug: string,
  streetQuery: string,
  house?: string,
): Promise<CoverageResult> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) return { matched: "none", addressText: streetQuery, groups: [] };

  const street = await prisma.street.findFirst({
    where: { cityId: city.id, name: { contains: streetQuery, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
  if (!street) {
    return { matched: "none", addressText: `${city.name}, ${streetQuery}`, groups: [] };
  }

  let matched: CoverageResult["matched"] = "street";
  let buildingId: string | undefined;
  let buildingIds: string[];

  if (house) {
    const building = await prisma.building.findFirst({
      where: { streetId: street.id, house: house },
      select: { id: true },
    });
    if (building) {
      matched = "building";
      buildingId = building.id;
      buildingIds = [building.id];
    } else {
      // Дом не нашли — показываем покрытие по улице как fallback.
      const all = await prisma.building.findMany({
        where: { streetId: street.id },
        select: { id: true },
      });
      buildingIds = all.map((b) => b.id);
    }
  } else {
    const all = await prisma.building.findMany({
      where: { streetId: street.id },
      select: { id: true },
    });
    buildingIds = all.map((b) => b.id);
  }

  const addressText =
    `${city.name}, ${street.name}` + (house ? `, д. ${house}` : "");

  if (buildingIds.length === 0) return { matched: "none", addressText, groups: [] };

  const coverage = await prisma.coverage.findMany({
    where: { buildingId: { in: buildingIds } },
    include: {
      provider: {
        include: {
          plans: {
            where: { isActive: true },
            include: { options: true },
            orderBy: { priceMonthly: "asc" },
          },
        },
      },
    },
  });

  // Дедуп по провайдеру (на улице один провайдер может покрывать много домов).
  const byProvider = new Map<string, ProviderGroup>();
  for (const c of coverage) {
    if (!c.provider.isActive) continue;
    if (byProvider.has(c.providerId)) continue;
    byProvider.set(c.providerId, {
      providerId: c.provider.id,
      providerName: c.provider.name,
      providerSlug: c.provider.slug,
      techNote: c.techNote,
      plans: c.provider.plans.map(toPlanView),
    });
  }

  const groups = [...byProvider.values()].filter((g) => g.plans.length > 0);
  return { matched, addressText, buildingId, groups };
}

// Для гео-SEO страницы улицы: провайдеры по конкретной улице (объединение покрытия домов).
export async function getStreetProviders(citySlug: string, streetSlug: string) {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) return null;

  const street = await prisma.street.findUnique({
    where: { cityId_slug: { cityId: city.id, slug: streetSlug } },
  });
  if (!street) return null;

  const buildings = await prisma.building.findMany({
    where: { streetId: street.id },
    select: { id: true },
  });
  const buildingIds = buildings.map((b) => b.id);

  const coverage =
    buildingIds.length > 0
      ? await prisma.coverage.findMany({
          where: { buildingId: { in: buildingIds } },
          include: {
            provider: {
              include: {
                plans: {
                  where: { isActive: true },
                  include: { options: true },
                  orderBy: { priceMonthly: "asc" },
                },
              },
            },
          },
        })
      : [];

  const byProvider = new Map<string, ProviderGroup>();
  for (const c of coverage) {
    if (!c.provider.isActive || byProvider.has(c.providerId)) continue;
    byProvider.set(c.providerId, {
      providerId: c.provider.id,
      providerName: c.provider.name,
      providerSlug: c.provider.slug,
      techNote: c.techNote,
      plans: c.provider.plans.map(toPlanView),
    });
  }

  return {
    city,
    street,
    buildingCount: buildingIds.length,
    groups: [...byProvider.values()].filter((g) => g.plans.length > 0),
  };
}

// Для гео-SEO страницы города: все провайдеры с тарифами, представленные в городе.
export async function getCityProviders(citySlug: string) {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) return null;

  const providers = await prisma.provider.findMany({
    where: {
      isActive: true,
      coverage: { some: { building: { street: { cityId: city.id } } } },
    },
    include: {
      plans: { where: { isActive: true }, include: { options: true }, orderBy: { priceMonthly: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const groups: ProviderGroup[] = providers
    .map((p) => ({
      providerId: p.id,
      providerName: p.name,
      providerSlug: p.slug,
      techNote: null,
      plans: p.plans.map(toPlanView),
    }))
    .filter((g) => g.plans.length > 0);

  return { city, groups };
}
