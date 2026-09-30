import { NextResponse } from "next/server";
import { removeDemoData } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Убрать демо-данные (кнопка в «Запуске»). Только покрытие из сида и тарифы не из
// прайса — реальные данные не трогаются (lib/demo.ts).
export async function POST() {
  try {
    return NextResponse.json(await removeDemoData());
  } catch (e) {
    console.error("Очистка демо-данных:", e);
    return NextResponse.json(
      { error: "Не удалось убрать демо-данные — ничего не изменено, попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
