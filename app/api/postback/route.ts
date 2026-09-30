import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { parseConversionStatus, parsePayout } from "@/lib/partner";

export const dynamic = "force-dynamic";

// Постбэк CPA-сети: статус конверсии по метке перехода. Адрес для кабинета сети:
//   https://<домен>/api/postback?token=<POSTBACK_TOKEN>&subid=<метка>&status=<статус>&payout=<сумма>
// Вместо <метка>, <статус>, <сумма> — макросы конкретной сети. Параметры принимаются
// и в query (GET), и в теле формы (POST). Без POSTBACK_TOKEN приём выключен.
async function handle(req: NextRequest) {
  const expected = process.env.POSTBACK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Постбэк не настроен: нет POSTBACK_TOKEN" }, { status: 503 });
  }

  const params = new URLSearchParams(req.nextUrl.searchParams);
  if (req.method === "POST") {
    try {
      const form = await req.formData();
      for (const [k, v] of form) if (typeof v === "string" && !params.has(k)) params.set(k, v);
    } catch {
      // тело не форма — хватит query
    }
  }

  if (!(await safeEqual(params.get("token") ?? "", expected))) {
    return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
  }

  // Сети называют метку по-разному.
  const subid = params.get("subid") ?? params.get("sub1") ?? params.get("click_id") ?? "";
  const statusRaw = (params.get("status") ?? "").trim();
  if (!subid || !statusRaw) {
    return NextResponse.json({ error: "Нужны subid и status" }, { status: 400 });
  }

  const click = await prisma.click.findUnique({ where: { id: subid }, select: { id: true } });
  if (!click) return NextResponse.json({ error: "Неизвестная метка" }, { status: 404 });

  const payout = parsePayout(params.get("payout"));
  await prisma.click.update({
    where: { id: click.id },
    data: {
      status: parseConversionStatus(statusRaw),
      statusRaw: statusRaw.slice(0, 50),
      // Сумму без значения не затираем: сети шлют её не в каждом статусе.
      ...(payout != null ? { payoutRub: payout } : {}),
      network: params.get("network")?.slice(0, 50) || undefined,
      statusAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
