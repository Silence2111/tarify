import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { suggestStreetsViaDaData } from "@/lib/dadata";

// Автокомплит улиц по городу.
// Если задан DADATA_API_KEY — подсказки по всей РФ через DaData (ФИАС/ГАР),
// иначе — из локальной базы (seed). Форма ответа одинаковая.
export async function GET(req: NextRequest) {
  const citySlug = req.nextUrl.searchParams.get("city")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!citySlug || !q || q.length < 2) {
    return NextResponse.json([]);
  }

  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
    select: { name: true },
  });
  if (!city) return NextResponse.json([]);

  // 1) Пробуем DaData (вернёт null, если ключ не задан или запрос не удался).
  const viaDaData = await suggestStreetsViaDaData(city.name, q);
  if (viaDaData) {
    return NextResponse.json(viaDaData);
  }

  // 2) Fallback: локальная база улиц.
  const streets = await prisma.street.findMany({
    where: { city: { slug: citySlug }, name: { contains: q, mode: "insensitive" } },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  return NextResponse.json(streets);
}
