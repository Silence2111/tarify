import type { Prisma } from "@prisma/client";
import { parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { priceChangeKind } from "@/lib/price-history";
import { UNLIMITED, type PlanView } from "@/lib/types";

// Импорт тарифов из CSV — прайс провайдеров: что в файле, то и на сайте.
// Одна строка — один тариф. Обязательные колонки: provider, plan, price.
// Необязательные: provider_name, payout, price_first, speed, tv, gb (синоним
// mobile), minutes, sms, esim, region, url, erid, type, description, options.
// Формат — data/PLANS.md.
//
// Прайс привязан к паре «провайдер + регион»: мобильные тарифы в каждом регионе
// стоят по-своему, и прайс Москвы не должен трогать тарифы Казани. Для каждой
// такой пары из файла:
//  - тариф узнаётся по названию: есть — обновляется, нет — создаётся;
//  - её тарифы, которых в файле нет, скрываются (isActive = false), а не
//    удаляются: на них ссылаются заявки;
// Заполненные provider_name и payout обновляют карточку провайдера, пустые не
// трогают её — пустая ячейка не должна обнулять ставку, по которой админка
// считает выручку. Провайдеров и регионов, которых в файле нет, импорт не касается.
//
// Сначала проверяется весь файл, и при любой ошибке не пишется ничего:
// наполовину залитый прайс хуже незалитого — опечатка в одной строке
// скрыла бы действующий тариф.

type PlanType = PlanView["type"];
const PLAN_TYPES: readonly PlanType[] = ["INTERNET", "TV", "MOBILE", "BUNDLE", "BUSINESS_ACCOUNT"];

export type PlanRow = {
  line: number;
  provider: string;
  providerName: string | null;
  payout: number | null;
  name: string;
  type: PlanType;
  priceMonthly: number;
  priceFirst: number | null;
  speedMbps: number | null;
  hasTv: boolean;
  tvChannels: number | null;
  hasMobile: boolean;
  mobileGb: number | null;
  minutes: number | null;
  sms: number | null;
  esim: boolean;
  region: string | null;
  url: string | null;
  erid: string | null;
  description: string | null;
  options: { label: string; value: string }[];
};

export type ImportError = { line: number; message: string };

export type PlansImportSummary = {
  rows: number;
  providersCreated: number;
  plansCreated: number;
  plansUpdated: number;
  plansHidden: number; // тарифы провайдеров из файла, которых в файле не оказалось
  pricesChanged: number; // подорожали или подешевели — попадут в ленту изменений цен
  changes: ImportedPriceChange[]; // всё, что попало в историю цен: для поста в Telegram
  errors: ImportError[];
};

export type ImportedPriceChange = {
  provider: string; // отображаемое имя
  plan: string;
  region: string | null;
  kind: "NEW" | "UP" | "DOWN" | "REMOVED";
  oldPrice: number | null;
  newPrice: number | null;
};

const YES = ["да", "yes", "true", "+"];
const NO = ["", "нет", "no", "false", "-"];
const UNLIMITED_WORDS = ["безлимит", "безлимитный", "безлимитные", "unlimited", "∞"];

// Целое число ₽ / Мбит/с / ГБ. «1 200» и «600 ₽» тоже принимаем: так пишут в таблицах.
function parseNumber(raw: string, column: string): number | null {
  const s = raw.replace(/[\s₽]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) throw new Error(`${column}: «${raw}» — нужно целое число`);
  return Number(s);
}

// Количество с безлимитом (ГБ, минуты, SMS): число или «безлимит».
function parseAmount(raw: string, column: string): number | null {
  if (UNLIMITED_WORDS.includes(raw.trim().toLowerCase())) return UNLIMITED;
  return parseNumber(raw, column);
}

// tv / gb: число (каналов / ГБ), «безлимит», «да» — есть без подробностей,
// пусто или «нет» — нет.
function parseFeature(raw: string, column: string): { has: boolean; amount: number | null } {
  const s = raw.trim().toLowerCase();
  if (NO.includes(s)) return { has: false, amount: null };
  if (YES.includes(s)) return { has: true, amount: null };
  const amount = parseAmount(s, column);
  return amount ? { has: true, amount } : { has: false, amount: null };
}

function parseFlag(raw: string, column: string): boolean {
  const s = raw.trim().toLowerCase();
  if (NO.includes(s)) return false;
  if (YES.includes(s)) return true;
  throw new Error(`${column}: «${raw}» — нужно «да» или «нет»`);
}

// Только http(s): ссылка уходит в href кнопки «Оформить».
function parseUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error(`url: «${s}» — не похоже на ссылку`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`url: «${s}» — нужна ссылка http(s)`);
  }
  return url.toString();
}

// «Wi-Fi роутер: в аренду 99 ₽/мес; Статический IP: 150 ₽/мес»
function parseOptions(raw: string): { label: string; value: string }[] {
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(":");
      const label = i > 0 ? part.slice(0, i).trim() : "";
      const value = i > 0 ? part.slice(i + 1).trim() : "";
      if (!label || !value) throw new Error(`options: «${part}» — нужен формат «название: значение»`);
      return { label, value };
    });
}

/** Разбор и проверка файла целиком, без записи в БД. */
export function parsePlansCsv(text: string): { rows: PlanRow[]; errors: ImportError[] } {
  const rows: PlanRow[] = [];
  const errors: ImportError[] = [];

  const grid = parseCsv(text);
  if (grid.length < 2) {
    errors.push({ line: 0, message: "Пустой CSV или нет строк данных" });
    return { rows, errors };
  }

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const ci = {
    provider: col("provider"),
    providerName: col("provider_name"),
    payout: col("payout"),
    plan: col("plan"),
    price: col("price"),
    priceFirst: col("price_first"),
    speed: col("speed"),
    tv: col("tv"),
    gb: col("gb", "mobile"),
    minutes: col("minutes"),
    sms: col("sms"),
    esim: col("esim"),
    region: col("region"),
    url: col("url"),
    erid: col("erid"),
    type: col("type"),
    description: col("description"),
    options: col("options"),
  };
  for (const req of ["provider", "plan", "price"] as const) {
    if (ci[req] < 0) {
      errors.push({ line: 1, message: `Нет обязательной колонки "${req}"` });
      return { rows, errors };
    }
  }

  const cell = (cells: string[], idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

  for (let r = 1; r < grid.length; r++) {
    const line = r + 1;
    const cells = grid[r];
    try {
      const provider = cell(cells, ci.provider).toLowerCase();
      const name = cell(cells, ci.plan);
      if (!provider || !name) throw new Error("пустое обязательное поле (provider/plan)");
      // Частая ошибка — вписать сюда отображаемое имя: получился бы второй провайдер.
      if (!/^[a-z0-9-]+$/.test(provider)) {
        throw new Error(`provider: «${provider}» — нужен слаг латиницей, например rostelecom`);
      }
      // 0 — законная цена: бесплатные счета для бизнеса, тарифы без абонплаты.
      const priceMonthly = parseNumber(cell(cells, ci.price), "price");
      if (priceMonthly == null) throw new Error("price: нужна цена в месяц, ₽ (0 — бесплатно)");
      const typeRaw = cell(cells, ci.type).toUpperCase() || "INTERNET";
      if (!PLAN_TYPES.includes(typeRaw as PlanType)) {
        throw new Error(`type: «${typeRaw}» — одно из ${PLAN_TYPES.join(", ")}`);
      }
      const tv = parseFeature(cell(cells, ci.tv), "tv");
      const gb = parseFeature(cell(cells, ci.gb), ci.gb >= 0 ? header[ci.gb] : "gb");

      rows.push({
        line,
        provider,
        providerName: cell(cells, ci.providerName) || null,
        payout: parseNumber(cell(cells, ci.payout), "payout"),
        name,
        type: typeRaw as PlanType,
        priceMonthly,
        priceFirst: parseNumber(cell(cells, ci.priceFirst), "price_first"),
        speedMbps: parseNumber(cell(cells, ci.speed), "speed"),
        hasTv: tv.has,
        tvChannels: tv.amount,
        hasMobile: gb.has,
        mobileGb: gb.amount,
        minutes: parseAmount(cell(cells, ci.minutes), "minutes"),
        sms: parseAmount(cell(cells, ci.sms), "sms"),
        esim: parseFlag(cell(cells, ci.esim), "esim"),
        region: cell(cells, ci.region) || null,
        url: parseUrl(cell(cells, ci.url)),
        erid: cell(cells, ci.erid) || null,
        description: cell(cells, ci.description) || null,
        options: parseOptions(cell(cells, ci.options)),
      });
    } catch (e) {
      errors.push({ line, message: e instanceof Error ? e.message : "ошибка строки" });
    }
  }

  // Проверки поперёк строк. Имя и ставка — свойства провайдера, а не тарифа:
  // разные значения в одном файле — почти наверняка опечатка, и какое из них
  // верное, мы не знаем.
  const firstPlan = new Map<string, number>();
  const firstValue = new Map<string, { value: string | number; line: number }>();
  for (const row of rows) {
    const planKey = `${row.provider}\n${row.region ?? ""}\n${row.name}`;
    const planLine = firstPlan.get(planKey);
    if (planLine) {
      const where = row.region ? ` (${row.region})` : "";
      errors.push({
        line: row.line,
        message: `тариф «${row.name}» у ${row.provider}${where} уже есть в строке ${planLine}`,
      });
    } else firstPlan.set(planKey, row.line);

    for (const [column, value] of [
      ["provider_name", row.providerName],
      ["payout", row.payout],
    ] as const) {
      if (value == null) continue;
      const key = `${row.provider}\n${column}`;
      const first = firstValue.get(key);
      if (!first) firstValue.set(key, { value, line: row.line });
      else if (first.value !== value) {
        errors.push({
          line: row.line,
          message: `${column} у ${row.provider}: «${value}», а в строке ${first.line} — «${first.value}»`,
        });
      }
    }
  }

  errors.sort((a, b) => a.line - b.line);
  return { rows, errors };
}

export async function importPlansCsv(text: string): Promise<PlansImportSummary> {
  const { rows, errors } = parsePlansCsv(text);
  const summary: PlansImportSummary = {
    rows: rows.length,
    providersCreated: 0,
    plansCreated: 0,
    plansUpdated: 0,
    plansHidden: 0,
    pricesChanged: 0,
    changes: [],
    errors,
  };
  if (errors.length > 0) return summary;

  // Провайдеры: создать новых, обновить имя и ставку у существующих.
  const providerIds = new Map<string, string>();
  const providerNames = new Map<string, string>();
  for (const slug of new Set(rows.map((r) => r.provider))) {
    const own = rows.filter((r) => r.provider === slug);
    const name = own.find((p) => p.providerName)?.providerName ?? null;
    const payout = own.find((p) => p.payout != null)?.payout ?? null;

    let provider: { id: string; name?: string } | null = await prisma.provider.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    providerNames.set(slug, name ?? provider?.name ?? slug);
    if (!provider) {
      provider = await prisma.provider.create({
        data: { slug, name: name ?? slug, payoutRub: payout },
        select: { id: true },
      });
      summary.providersCreated++;
    } else if (name || payout != null) {
      await prisma.provider.update({
        where: { id: provider.id },
        data: { ...(name ? { name } : {}), ...(payout != null ? { payoutRub: payout } : {}) },
      });
    }
    providerIds.set(slug, provider.id);
  }

  // Прайсы: по паре «провайдер + регион».
  const scopes = new Map<string, PlanRow[]>();
  for (const row of rows) {
    const key = `${row.provider}\n${row.region ?? ""}`;
    const list = scopes.get(key);
    if (list) list.push(row);
    else scopes.set(key, [row]);
  }

  for (const plans of scopes.values()) {
    const providerId = providerIds.get(plans[0].provider)!;
    const region = plans[0].region;

    const existing = await prisma.plan.findMany({
      where: { providerId, region },
      select: { id: true, name: true, isActive: true, priceMonthly: true },
    });
    const byName = new Map(existing.map((p) => [p.name, p]));
    const listed = new Set<string>();
    // История цен. Первая загрузка прайса пары — не новость: иначе лента утонет
    // в «новых тарифах», которые на самом деле просто впервые попали на сайт.
    const changes: Prisma.PriceChangeCreateManyInput[] = [];
    const firstLoad = existing.length === 0;
    const planNames = new Map(existing.map((p) => [p.id, p.name]));

    for (const row of plans) {
      const data = {
        name: row.name,
        type: row.type,
        priceMonthly: row.priceMonthly,
        priceFirst: row.priceFirst,
        speedMbps: row.speedMbps,
        hasTv: row.hasTv,
        tvChannels: row.tvChannels,
        hasMobile: row.hasMobile,
        mobileGb: row.mobileGb,
        minutes: row.minutes,
        sms: row.sms,
        esim: row.esim,
        region: row.region,
        url: row.url,
        erid: row.erid,
        description: row.description,
        isActive: true,
      };
      const found = byName.get(row.name);
      if (found) {
        await prisma.plan.update({
          where: { id: found.id },
          data: { ...data, options: { deleteMany: {}, create: row.options } },
        });
        listed.add(found.id);
        summary.plansUpdated++;
        const kind = found.isActive ? priceChangeKind(found.priceMonthly, row.priceMonthly) : "NEW";
        if (kind) {
          // Скрытый тариф вернулся в прайс — для ленты это снова новый тариф.
          changes.push({
            planId: found.id,
            kind,
            oldPrice: kind === "NEW" ? null : found.priceMonthly,
            newPrice: row.priceMonthly,
          });
          if (kind !== "NEW") summary.pricesChanged++;
        }
      } else {
        const created = await prisma.plan.create({
          data: { ...data, providerId, options: { create: row.options } },
          select: { id: true },
        });
        listed.add(created.id);
        planNames.set(created.id, row.name);
        summary.plansCreated++;
        if (!firstLoad) {
          changes.push({ planId: created.id, kind: "NEW", oldPrice: null, newPrice: row.priceMonthly });
        }
      }
    }

    const stale = existing.filter((p) => p.isActive && !listed.has(p.id));
    if (stale.length > 0) {
      await prisma.plan.updateMany({
        where: { id: { in: stale.map((p) => p.id) } },
        data: { isActive: false },
      });
      summary.plansHidden += stale.length;
      for (const p of stale) {
        changes.push({ planId: p.id, kind: "REMOVED", oldPrice: p.priceMonthly, newPrice: null });
      }
    }
    if (changes.length > 0) {
      await prisma.priceChange.createMany({ data: changes });
      for (const c of changes) {
        summary.changes.push({
          provider: providerNames.get(plans[0].provider) ?? plans[0].provider,
          plan: planNames.get(c.planId) ?? "",
          region,
          kind: c.kind,
          oldPrice: c.oldPrice ?? null,
          newPrice: c.newPrice ?? null,
        });
      }
    }
  }

  return summary;
}
