import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

// Передача заявки дальше — в CPA-сеть или CRM, — как только она пришла. Раньше заявки
// уходили в сеть выгрузкой CSV вручную; час задержки — это остывший клиент и ниже
// аппрув. Адрес приёма — LEAD_WEBHOOK_URL: у каждой сети свой API, поэтому поля
// подставляются в адрес по шаблону ({name}, {phone}, {subid}…), а в теле POST уходит
// JSON со всеми полями. id заявки идёт меткой subid — по ней постбэк вернёт статус.

export type LeadFields = {
  id: string;
  subid: string;
  name: string;
  phone: string;
  phone_digits: string;
  company: string;
  address: string;
  city: string;
  provider: string;
  provider_slug: string;
  plan: string;
  created_at: string;
  site: string;
};

/** Телефон для API сетей: 11 цифр с семёркой — «8 (900) 123-45-67» → «79001234567». */
export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `7${d}`;
  if (d.length === 11 && d.startsWith("8")) return `7${d.slice(1)}`;
  return d;
}

/** Подставить поля заявки в шаблон адреса. Значения кодируются; незнакомые {…} не трогаем. */
export function fillTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    Object.hasOwn(fields, key) ? encodeURIComponent(fields[key]) : m,
  );
}

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  addressText: string;
  createdAt: Date;
  plan: { name: string; provider: { name: string; slug: string } } | null;
  building: { street: { city: { name: string } } } | null;
};

export function leadFields(l: LeadRow): LeadFields {
  return {
    id: l.id,
    subid: l.id,
    name: l.name,
    phone: l.phone,
    phone_digits: normalizePhone(l.phone),
    company: l.company ?? "",
    address: l.addressText,
    city: l.building?.street.city.name ?? "",
    provider: l.plan?.provider.name ?? "",
    provider_slug: l.plan?.provider.slug ?? "",
    plan: l.plan?.name ?? "",
    created_at: l.createdAt.toISOString(),
    site: siteUrl(),
  };
}

/**
 * Уведомление оператору в Telegram — без имени, телефона и адреса: это персональные
 * данные, и в сторонний мессенджер они не уходят. Контакт — по ссылке в админке.
 */
export function leadNotice(f: LeadFields): string {
  const what = f.plan
    ? `${escapeHtml(f.provider)} «${escapeHtml(f.plan)}»`
    : f.company
      ? "интернет в офис"
      : "подбор тарифа";
  const where = f.city ? ` · ${escapeHtml(f.city)}` : "";
  return `Новая заявка: ${what}${where}\n<a href="${f.site}/admin/leads">Открыть в админке</a>`;
}

export function deliveryEnabled(): boolean {
  return Boolean(process.env.LEAD_WEBHOOK_URL);
}

/** Хост адреса приёма — показать в админке, не раскрывая токен из адреса. */
export function deliveryHost(): string | null {
  try {
    return process.env.LEAD_WEBHOOK_URL ? new URL(process.env.LEAD_WEBHOOK_URL).host : null;
  } catch {
    return null;
  }
}

async function postLead(url: string, f: LeadFields): Promise<string | null> {
  try {
    const res = await fetch(fillTemplate(url, f), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return null;
    return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`.trim();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Передать заявку в сеть (если задан LEAD_WEBHOOK_URL) и уведомить оператора (если
 * задан TELEGRAM_LEADS_CHAT_ID). Результат передачи — у заявки: deliveredAt или
 * deliveryError. Никогда не бросает: вызывается после ответа посетителю.
 */
export async function deliverLead(
  id: string,
  opts: { notify?: boolean } = { notify: true },
): Promise<{ delivered: boolean; error: string | null }> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        plan: { include: { provider: { select: { name: true, slug: true } } } },
        building: { include: { street: { include: { city: { select: { name: true } } } } } },
      },
    });
    if (!lead) return { delivered: false, error: "Заявка не найдена" };
    const fields = leadFields(lead);

    const url = process.env.LEAD_WEBHOOK_URL;
    const chat = process.env.TELEGRAM_LEADS_CHAT_ID;
    const [error] = await Promise.all([
      url ? postLead(url, fields) : Promise.resolve(null),
      chat && opts.notify ? sendTelegram(chat, leadNotice(fields)) : Promise.resolve(null),
    ]);
    if (!url) return { delivered: false, error: null };

    await prisma.lead.update({
      where: { id },
      data: error
        ? { deliveryError: error.slice(0, 300) }
        : { deliveredAt: new Date(), deliveryError: null },
    });
    return { delivered: !error, error };
  } catch (e) {
    console.error("deliverLead", id, e);
    return { delivered: false, error: e instanceof Error ? e.message : String(e) };
  }
}
