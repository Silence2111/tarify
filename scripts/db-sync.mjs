// Синхронизация схемы БД перед сборкой на Vercel: новые колонки и типы тарифов
// появляются в базе раньше, чем новый код начнёт их читать, — иначе после деплоя
// падали бы все страницы с тарифами. Локально (без VERCEL=1) ничего не делает.
//
// `prisma db push` без --accept-data-loss отказывается от изменений, теряющих
// данные: такая сборка упадёт, и на сайте останется прошлая версия.
// Нужна переменная DIRECT_URL (прямое подключение к Neon, без -pooler).
import { execSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  // Без DIRECT_URL Prisma падает с невнятным P1012 — объясняем сами.
  if (!process.env.DIRECT_URL) {
    console.error(
      "DIRECT_URL не задана. Добавьте в Vercel → Settings → Environment Variables прямую " +
        "строку подключения Neon (без -pooler) и перезапустите сборку. Без неё схему базы " +
        "не обновить, а новая версия сайта упала бы на страницах с тарифами.",
    );
    process.exit(1);
  }
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
}
