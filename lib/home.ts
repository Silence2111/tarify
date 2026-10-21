import { cache } from "react";
import { prisma } from "@/lib/db";
import { HOME_PLAN_TYPES } from "@/lib/types";

/**
 * Есть ли что искать по адресу: города в базе и активные тарифы домашнего интернета.
 * Нет (запуск с мобильной связи: демо убрано, покрытие ещё не собрано) — главная
 * ведёт в мобильную связь, а в шапке нет пункта «Интернет по адресу»: иначе он вёл
 * бы к поиску, который ничего не найдёт.
 *
 * Шапку статических страниц (политика, согласие) Next собирает при сборке, там ответ
 * держится до следующей выкатки. Ошибка базы — «есть»: шапка и главная как раньше.
 */
export const hasAddressSearch = cache(async function hasAddressSearch(): Promise<boolean> {
  try {
    const [city, plan] = await Promise.all([
      prisma.city.findFirst({ select: { id: true } }),
      prisma.plan.findFirst({
        where: { isActive: true, type: { in: [...HOME_PLAN_TYPES] } },
        select: { id: true },
      }),
    ]);
    return Boolean(city && plan);
  } catch {
    return true;
  }
});
