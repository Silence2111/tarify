import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isBot, refererPath, withSubid } from "@/lib/partner";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Переход «Оформить»: записываем клик и уводим на партнёрскую ссылку, подставив
// id клика вместо {subid}. Постбэк CPA-сети вернёт этот id со статусом конверсии.
export async function GET(req: NextRequest, ctx: { params: Promise<{ planId: string }> }) {
  const { planId } = await ctx.params;
  const plan = await prisma.plan.findFirst({
    where: { id: planId, isActive: true, url: { not: null } },
    select: { id: true, url: true, providerId: true },
  });
  if (!plan?.url) return NextResponse.redirect(new URL("/", req.url));

  // Роботов и частые повторы (двойные клики, накрутка) в статистику не пишем,
  // но человека всё равно отправляем к оператору.
  let subid = "";
  const rl = await rateLimit(`go:${clientIp(req)}`, 20, 60_000);
  if (rl.ok && !isBot(req.headers.get("user-agent"))) {
    const click = await prisma.click.create({
      data: {
        planId: plan.id,
        providerId: plan.providerId,
        page: refererPath(req.headers.get("referer"), req.headers.get("host")),
      },
      select: { id: true },
    });
    subid = click.id;
  }

  const res = NextResponse.redirect(withSubid(plan.url, subid), 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
