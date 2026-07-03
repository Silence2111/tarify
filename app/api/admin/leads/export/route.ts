import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Выгрузка лидов в CSV для сверки с CPA-сетью/провайдером.
// По умолчанию — только подтверждённые (за них платит провайдер). ?status=ALL — все.
const STATUSES = ["NEW", "CALLED", "CONFIRMED", "REJECTED"] as const;

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get("status") ?? "CONFIRMED";
  const where =
    statusParam !== "ALL" && (STATUSES as readonly string[]).includes(statusParam)
      ? { status: statusParam as (typeof STATUSES)[number] }
      : {};

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { plan: { include: { provider: true } } },
  });

  const header = [
    "id", "created_at", "status", "name", "phone", "address", "provider", "plan", "payout_rub",
  ];
  const lines = [header.join(",")];
  for (const l of leads) {
    lines.push(
      [
        l.id,
        l.createdAt.toISOString(),
        l.status,
        l.name,
        l.phone,
        l.addressText,
        l.plan?.provider.name ?? "",
        l.plan?.name ?? "",
        l.plan?.provider.payoutRub ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM — чтобы Excel корректно открыл кириллицу в UTF-8.
  const body = "﻿" + lines.join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${statusParam.toLowerCase()}.csv"`,
    },
  });
}
