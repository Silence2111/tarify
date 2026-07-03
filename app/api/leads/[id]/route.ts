import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const STATUSES = ["NEW", "CALLED", "CONFIRMED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

// Обновление статуса заявки оператором: NEW → CALLED → CONFIRMED/REJECTED.
// CONFIRMED = подтверждённое подключение, за которое платит провайдер.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, comment } = (body ?? {}) as Record<string, unknown>;
  if (typeof status !== "string" || !STATUSES.includes(status as Status)) {
    return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status: status as Status,
        ...(typeof comment === "string" ? { comment } : {}),
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, id: lead.id, status: lead.status });
  } catch {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
}
