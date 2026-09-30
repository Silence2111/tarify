import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/admin-auth";
import { applyPostback } from "@/lib/postback";

export const dynamic = "force-dynamic";

// Постбэк CPA-сети: статус конверсии по метке перехода или заявки. Адрес для кабинета сети:
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

  const result = await applyPostback(params);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code });
  // Устаревший статус (промежуточный после итогового) тоже 200: иначе сеть будет повторять.
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
