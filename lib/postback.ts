import { prisma } from "@/lib/db";
import {
  isFinalStatus,
  leadStatusFromConversion,
  parseConversionStatus,
  parsePayout,
  shouldApplyStatus,
  type ConversionStatus,
} from "@/lib/partner";

/**
 * Условие записи: промежуточный статус пишем, только если в базе нет итогового.
 * Проверка и запись — одним UPDATE: два одновременных постбэка (повтор «pending» и
 * «approved») иначе оба прошли бы проверку, и «pending» мог бы лечь последним.
 */
function notFinalGuard(field: "status" | "networkStatus", incoming: ConversionStatus) {
  if (isFinalStatus(incoming)) return {};
  return { OR: [{ [field]: null }, { [field]: { in: ["PENDING", "HOLD"] as ConversionStatus[] } }] };
}

export type PostbackResult =
  | { ok: true; target: "click" | "lead"; applied: boolean }
  | { ok: false; code: 400 | 404; error: string };

/**
 * Статус конверсии от CPA-сети по метке. Метка — id перехода по «Оформить» (его
 * подставляет /go в партнёрскую ссылку) или id заявки, если заявку передали в сеть
 * с этим id в subid. Параметры уже проверены на токен.
 */
export async function applyPostback(params: URLSearchParams): Promise<PostbackResult> {
  // Сети называют метку по-разному.
  const subid = (params.get("subid") ?? params.get("sub1") ?? params.get("click_id") ?? "").trim();
  const statusRaw = (params.get("status") ?? "").trim();
  if (!subid || !statusRaw) return { ok: false, code: 400, error: "Нужны subid и status" };

  const incoming = parseConversionStatus(statusRaw);
  const payout = parsePayout(params.get("payout"));
  const network = params.get("network")?.slice(0, 50) || undefined;
  const now = new Date();
  // Сумму без значения не затираем: сети шлют её не в каждом статусе.
  const payoutData = payout != null ? { payoutRub: payout } : {};

  const click = await prisma.click.findUnique({
    where: { id: subid },
    select: { id: true, status: true },
  });
  if (click) {
    if (!shouldApplyStatus(click.status, incoming)) {
      return { ok: true, target: "click", applied: false };
    }
    const { count } = await prisma.click.updateMany({
      where: { id: click.id, ...notFinalGuard("status", incoming) },
      data: {
        status: incoming,
        statusRaw: statusRaw.slice(0, 50),
        ...payoutData,
        network,
        statusAt: now,
      },
    });
    return { ok: true, target: "click", applied: count > 0 };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: subid },
    select: { id: true, status: true, networkStatus: true },
  });
  if (!lead) return { ok: false, code: 404, error: "Неизвестная метка" };
  if (!shouldApplyStatus(lead.networkStatus, incoming)) {
    return { ok: true, target: "lead", applied: false };
  }
  const { count } = await prisma.lead.updateMany({
    where: { id: lead.id, ...notFinalGuard("networkStatus", incoming) },
    data: {
      status: leadStatusFromConversion(lead.status, incoming),
      networkStatus: incoming,
      networkStatusRaw: statusRaw.slice(0, 50),
      ...payoutData,
      network,
      networkAt: now,
    },
  });
  return { ok: true, target: "lead", applied: count > 0 };
}
