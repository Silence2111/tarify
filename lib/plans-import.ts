import { parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import type { PlanView } from "@/lib/types";

// Импорт тарифов из CSV — прайс провайдеров: что в файле, то и на сайте.
// Одна строка — один тариф. Обязательные колонки: provider, plan, price.
// Необязательные: provider_name, payout, price_first, speed, tv, mobile, type,
// description, options. Формат — data/PLANS.md.
//
// Для каждого провайдера из файла:
//  - тариф узнаётся по названию: есть — обновляется, нет — создаётся;
//  - его тарифы, которых в файле нет, скрываются (isActive = false), а не
//    удаляются: на них ссылаются заявки;
//  - заполненные provider_name и payout обновляют карточку провайдера, пустые
//    не трогают её — пустая ячейка не должна обнулять ставку, по которой
//    админка считает выручку.
// Провайдеров, которых в файле нет, импорт не касается.
//
// Сначала проверяется весь файл, и при любой ошибке не пишется ничего:
// наполовину залитый прайс хуже незалитого — опечатка в одной строке
// скрыла бы действующий тариф.

type PlanType = PlanView["type"];
const PLAN_TYPES: readonly PlanType[] = ["INTERNET", "TV", "MOBILE", "BUNDLE"];

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
  errors: ImportError[];
};

// Целое число ₽ / Мбит/с / ГБ. «1 200» и «600 ₽» тоже принимаем: так пишут в таблицах.
function parseNumber(raw: string, column: string): number | null {
  const s = raw.replace(/[\s₽]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) throw new Error(`${column}: «${raw}» — нужно целое число`);
  return Number(s);
}

// tv / mobile: число (каналов / ГБ), «да» — есть без подробностей, пусто или «нет» — нет.
function parseFeature(raw: string, column: string): { has: boolean; amount: number | null } {
  const s = raw.trim().toLowerCase();
  if (["", "нет", "no", "false", "-"].includes(s)) return { has: false, amount: null };
  if (["да", "yes", "true", "+"].includes(s)) return { has: true, amount: null };
  const amount = parseNumber(s, column);
  return amount ? { has: true, amount } : { has: false, amount: null };
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
  const ci = {
    provider: header.indexOf("provider"),
    providerName: header.indexOf("provider_name"),
    payout: header.indexOf("payout"),
    plan: header.indexOf("plan"),
    price: header.indexOf("price"),
    priceFirst: header.indexOf("price_first"),
    speed: header.indexOf("speed"),
    tv: header.indexOf("tv"),
    mobile: header.indexOf("mobile"),
    type: header.indexOf("type"),
    description: header.indexOf("description"),
    options: header.indexOf("options"),
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
      const priceMonthly = parseNumber(cell(cells, ci.price), "price");
      if (!priceMonthly) throw new Error("price: нужна цена в месяц, ₽");
      const typeRaw = cell(cells, ci.type).toUpperCase() || "INTERNET";
      if (!PLAN_TYPES.includes(typeRaw as PlanType)) {
        throw new Error(`type: «${typeRaw}» — одно из ${PLAN_TYPES.join(", ")}`);
      }
      const tv = parseFeature(cell(cells, ci.tv), "tv");
      const mobile = parseFeature(cell(cells, ci.mobile), "mobile");

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
        hasMobile: mobile.has,
        mobileGb: mobile.amount,
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
    const planKey = `${row.provider}\n${row.name}`;
    const planLine = firstPlan.get(planKey);
    if (planLine) {
      errors.push({
        line: row.line,
        message: `тариф «${row.name}» у ${row.provider} уже есть в строке ${planLine}`,
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
    errors,
  };
  if (errors.length > 0) return summary;

  const byProvider = new Map<string, PlanRow[]>();
  for (const row of rows) {
    const list = byProvider.get(row.provider);
    if (list) list.push(row);
    else byProvider.set(row.provider, [row]);
  }

  for (const [slug, plans] of byProvider) {
    const name = plans.find((p) => p.providerName)?.providerName ?? null;
    const payout = plans.find((p) => p.payout != null)?.payout ?? null;

    let provider = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
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

    const existing = await prisma.plan.findMany({
      where: { providerId: provider.id },
      select: { id: true, name: true, isActive: true },
    });
    const byName = new Map(existing.map((p) => [p.name, p]));
    const listed = new Set<string>();

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
      } else {
        const created = await prisma.plan.create({
          data: { ...data, providerId: provider.id, options: { create: row.options } },
          select: { id: true },
        });
        listed.add(created.id);
        summary.plansCreated++;
      }
    }

    const stale = existing.filter((p) => p.isActive && !listed.has(p.id)).map((p) => p.id);
    if (stale.length > 0) {
      await prisma.plan.updateMany({ where: { id: { in: stale } }, data: { isActive: false } });
      summary.plansHidden += stale.length;
    }
  }

  return summary;
}
