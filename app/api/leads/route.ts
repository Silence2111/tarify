import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Приём заявки на подключение — это и есть «деньги» воронки.
export async function POST(req: NextRequest) {
  // Защита от спама форм: не больше 5 заявок с одного IP в минуту.
  const rl = await rateLimit(`lead:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много заявок, попробуйте позже" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, addressText, planId, buildingId, consent } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  }
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (digits.length < 10) {
    return NextResponse.json({ error: "Укажите корректный телефон" }, { status: 400 });
  }
  // 152-ФЗ: без согласия на обработку ПДн заявку не принимаем.
  if (consent !== true) {
    return NextResponse.json({ error: "Требуется согласие на обработку данных" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      name: name.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      addressText: typeof addressText === "string" ? addressText.trim() : "",
      planId: typeof planId === "string" ? planId : null,
      buildingId: typeof buildingId === "string" ? buildingId : null,
      consent: true,
      status: "NEW",
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
