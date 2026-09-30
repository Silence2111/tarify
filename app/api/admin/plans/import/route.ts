import { NextRequest, NextResponse } from "next/server";
import { importPlansCsv } from "@/lib/plans-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Импорт тарифов из CSV. Как и импорт покрытия, принимает multipart-форму
// (поле file) или сырое тело text/csv. Если в файле есть ошибки, ничего не
// записывается — отвечаем 422 со списком ошибок по строкам.
export async function POST(req: NextRequest) {
  let csv = "";
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (file && typeof file !== "string") csv = await file.text();
    } else {
      csv = await req.text();
    }
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать данные" }, { status: 400 });
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "Пустой CSV" }, { status: 400 });
  }

  const summary = await importPlansCsv(csv);
  if (summary.errors.length > 0) {
    return NextResponse.json(
      { error: "В файле есть ошибки — ничего не загружено", ...summary },
      { status: 422 },
    );
  }
  return NextResponse.json(summary);
}
