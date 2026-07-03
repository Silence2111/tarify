// CLI-импорт фида покрытия (для cron/ручной заливки). Идёт через тот же
// защищённый HTTP-эндпоинт, что и админка, — значит проходит ту же валидацию.
//
// Использование:
//   node scripts/import-coverage.mjs <file.csv> [source]
// Переменные окружения: ADMIN_PASSWORD (по умолчанию "admin"), SITE_URL (по умолчанию localhost:3000).
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [, , filePath, sourceArg] = process.argv;
if (!filePath) {
  console.error("usage: node scripts/import-coverage.mjs <file.csv> [source]");
  process.exit(1);
}

const base = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD || "admin";

const csv = readFileSync(filePath, "utf8");

const login = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!login.ok) {
  console.error(`Логин не удался: HTTP ${login.status}. Проверьте ADMIN_PASSWORD.`);
  process.exit(1);
}
const setCookie = login.headers.get("set-cookie") || "";
const cookie = setCookie.split(";")[0]; // admin_session=...

const fd = new FormData();
fd.append("file", new Blob([csv], { type: "text/csv" }), basename(filePath));
if (sourceArg) fd.append("source", sourceArg);

const res = await fetch(`${base}/api/admin/coverage/import`, {
  method: "POST",
  headers: { cookie },
  body: fd,
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
process.exit(res.ok ? 0 : 1);
