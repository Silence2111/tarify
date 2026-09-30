import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseLeadUpdate } from "@/lib/lead-update";

// Оператор меняет статус заявки (NEW → CALLED → CONFIRMED/REJECTED) и/или заметку к ней.
// CONFIRMED = подтверждённое подключение, за которое платит провайдер.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update = parseLeadUpdate(body);
  if ("error" in update) {
    return NextResponse.json({ error: update.error }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: update.data,
      select: { id: true, status: true, comment: true },
    });
    return NextResponse.json({ ok: true, ...lead });
  } catch {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
}
