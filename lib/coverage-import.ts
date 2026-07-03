import { prisma } from "@/lib/db";
import { slugify } from "@/lib/format";

// Импорт матрицы покрытия из CSV (фиды провайдеров / ручной сбор).
// Заголовок (первая строка) задаёт колонки. Обязательные: city, street, house, provider.
// Необязательные: provider_name, tech, payout.
// Идемпотентно: повторный импорт не плодит дубли (Coverage уникален по дом+провайдер).

export type ImportSummary = {
  rows: number;
  coverageCreated: number;
  coverageUpdated: number; // существовавшие — обновлены (освежён updatedAt/source)
  providersCreated: number;
  buildingsCreated: number;
  errors: { line: number; message: string }[];
};

// Минимальный CSV-парсер с поддержкой кавычек и экранирования "".
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function importCoverageCsv(
  text: string,
  defaultSource = "csv",
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    rows: 0,
    coverageCreated: 0,
    coverageUpdated: 0,
    providersCreated: 0,
    buildingsCreated: 0,
    errors: [],
  };

  const grid = parseCsv(text);
  if (grid.length < 2) {
    summary.errors.push({ line: 0, message: "Пустой CSV или нет строк данных" });
    return summary;
  }

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const ci = {
    city: header.indexOf("city"),
    street: header.indexOf("street"),
    house: header.indexOf("house"),
    provider: header.indexOf("provider"),
    providerName: header.indexOf("provider_name"),
    tech: header.indexOf("tech"),
    payout: header.indexOf("payout"),
    source: header.indexOf("source"),
  };
  for (const req of ["city", "street", "house", "provider"] as const) {
    if (ci[req] < 0) {
      summary.errors.push({ line: 1, message: `Нет обязательной колонки "${req}"` });
      return summary;
    }
  }

  // Кэши, чтобы не дёргать БД на каждую строку.
  const cityCache = new Map<string, string>();
  const streetCache = new Map<string, string>();
  const providerCache = new Map<string, string>();
  const buildingCache = new Map<string, string>();

  const cell = (cells: string[], idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

  for (let r = 1; r < grid.length; r++) {
    const line = r + 1;
    const cells = grid[r];
    summary.rows++;
    try {
      const cityName = cell(cells, ci.city);
      const streetName = cell(cells, ci.street);
      const house = cell(cells, ci.house);
      const providerSlug = cell(cells, ci.provider).toLowerCase();
      const providerName = cell(cells, ci.providerName) || providerSlug;
      const tech = cell(cells, ci.tech) || null;
      const payoutRaw = cell(cells, ci.payout);
      const payout = payoutRaw ? parseInt(payoutRaw, 10) : null;
      const source = cell(cells, ci.source) || defaultSource;

      if (!cityName || !streetName || !house || !providerSlug) {
        throw new Error("пустое обязательное поле (city/street/house/provider)");
      }

      // City
      const citySlug = slugify(cityName);
      let cityId = cityCache.get(citySlug);
      if (!cityId) {
        const city = await prisma.city.upsert({
          where: { slug: citySlug },
          update: {},
          create: { slug: citySlug, name: cityName },
        });
        cityId = city.id;
        cityCache.set(citySlug, cityId);
      }

      // Street
      const streetSlug = slugify(streetName);
      const streetKey = `${cityId}:${streetSlug}`;
      let streetId = streetCache.get(streetKey);
      if (!streetId) {
        const street = await prisma.street.upsert({
          where: { cityId_slug: { cityId, slug: streetSlug } },
          update: {},
          create: { cityId, slug: streetSlug, name: streetName },
        });
        streetId = street.id;
        streetCache.set(streetKey, streetId);
      }

      // Provider (create with name/payout if new)
      let providerId = providerCache.get(providerSlug);
      if (!providerId) {
        const existing = await prisma.provider.findUnique({ where: { slug: providerSlug } });
        if (existing) {
          providerId = existing.id;
        } else {
          const created = await prisma.provider.create({
            data: { slug: providerSlug, name: providerName, payoutRub: payout },
          });
          providerId = created.id;
          summary.providersCreated++;
        }
        providerCache.set(providerSlug, providerId);
      }

      // Building
      const buildingKey = `${streetId}:${house}`;
      let buildingId = buildingCache.get(buildingKey);
      if (!buildingId) {
        const existing = await prisma.building.findUnique({
          where: { streetId_house: { streetId, house } },
        });
        if (existing) {
          buildingId = existing.id;
        } else {
          const created = await prisma.building.create({ data: { streetId, house } });
          buildingId = created.id;
          summary.buildingsCreated++;
        }
        buildingCache.set(buildingKey, buildingId);
      }

      // Coverage (уникально по дом+провайдер). Повторный импорт освежает запись.
      const cov = await prisma.coverage.findUnique({
        where: { buildingId_providerId: { buildingId, providerId } },
        select: { id: true },
      });
      if (cov) {
        await prisma.coverage.update({
          where: { id: cov.id },
          data: { techNote: tech, source }, // updatedAt обновится автоматически
        });
        summary.coverageUpdated++;
      } else {
        await prisma.coverage.create({
          data: { buildingId, providerId, techNote: tech, source },
        });
        summary.coverageCreated++;
      }
    } catch (e) {
      summary.errors.push({ line, message: e instanceof Error ? e.message : "ошибка строки" });
    }
  }

  return summary;
}
