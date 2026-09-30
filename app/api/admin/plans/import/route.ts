import { after, NextRequest, NextResponse } from "next/server";
import { importPlansCsv } from "@/lib/plans-import";
import { priceChangesPost } from "@/lib/price-post";
import { siteUrl } from "@/lib/site";
import { sendTelegram } from "@/lib/telegram";

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

  // Изменения цен — постом в Telegram-канал, после ответа: загрузка не ждёт Telegram.
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  const post = channel ? priceChangesPost(summary.changes, siteUrl()) : null;
  if (channel && post) {
    after(async () => {
      const sent = await sendTelegram(channel, post);
      if (!sent.ok) console.error("Пост об изменениях цен не ушёл в Telegram:", sent.error);
    });
  }
  return NextResponse.json(summary);
}
