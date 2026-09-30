import { NextRequest, NextResponse } from "next/server";
import { deliverLead, deliveryEnabled } from "@/lib/lead-delivery";

export const dynamic = "force-dynamic";

// Отправить заявку в сеть ещё раз — после ошибки или если передачу включили позже.
// Оператора в Telegram повторно не уведомляем: он уже в админке.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!deliveryEnabled()) {
    return NextResponse.json({ error: "Передача выключена: нет LEAD_WEBHOOK_URL" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const result = await deliverLead(id, { notify: false });
  return NextResponse.json(result, { status: result.delivered ? 200 : 502 });
}
