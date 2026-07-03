import { NextRequest, NextResponse } from "next/server";
import { importCoverageCsv } from "@/lib/coverage-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Импорт покрытия из CSV. Принимает либо multipart-форму (поле file),
// либо сырое тело text/csv. Возвращает сводку импорта.
export async function POST(req: NextRequest) {
  let csv = "";
  // Источник фида (для атрибуции/свежести): из формы, query или имени файла.
  let source = req.nextUrl.searchParams.get("source")?.trim() || "";
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (typeof form.get("source") === "string") source = String(form.get("source")).trim();
      if (file && typeof file !== "string") {
        csv = await file.text();
        if (!source && file.name) source = file.name.replace(/\.csv$/i, "");
      } else if (typeof form.get("csv") === "string") {
        csv = String(form.get("csv"));
      }
    } else {
      csv = await req.text();
    }
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать данные" }, { status: 400 });
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "Пустой CSV" }, { status: 400 });
  }

  const summary = await importCoverageCsv(csv, source || "csv");
  return NextResponse.json(summary);
}
