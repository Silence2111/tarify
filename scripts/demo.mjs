// Демо-стенд одной командой: npm run demo → http://127.0.0.1:3050
//
// Поднимает свой Postgres без установки (embedded-postgres, данные в
// ./.pgdata-demo), заливает демо-данные и запускает собранный сайт.
// Рабочий .env не читается для базы: адрес передаётся переменной окружения,
// поэтому стенд не попадёт ни в чужой Postgres на 5433, ни в боевой Neon.
//
// Порт базы — PGPORT_LOCAL (по умолчанию 5435), порт сайта — DEMO_PORT (3050).
import pkg from "embedded-postgres";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const EmbeddedPostgres = pkg.default ?? pkg;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PG_PORT = Number(process.env.PGPORT_LOCAL ?? 5435);
const WEB_PORT = Number(process.env.DEMO_PORT ?? 3050);
const dataDir = join(root, ".pgdata-demo");

function portTaken(port) {
  return new Promise((resolve) => {
    const s = createConnection({ port, host: "127.0.0.1" });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    setTimeout(() => { s.destroy(); resolve(false); }, 500);
  });
}

for (const [port, what, env] of [[PG_PORT, "базы", "PGPORT_LOCAL"], [WEB_PORT, "сайта", "DEMO_PORT"]]) {
  if (await portTaken(port)) {
    console.error(`Порт ${port} для ${what} занят. Посмотреть кем: lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
      `Запустить на другом: ${env}=${port + 10} npm run demo`);
    process.exit(1);
  }
}

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PG_PORT, persistent: true });
if (!existsSync(join(dataDir, "PG_VERSION"))) {
  console.log("→ Первый запуск: создаю кластер Postgres");
  await pg.initialise();
}
await pg.start();
try { await pg.createDatabase("tarify_demo"); } catch { /* уже есть */ }

const url = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/tarify_demo`;
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: url,
  DIRECT_URL: url,
  NEXT_PUBLIC_DEMO: "1",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${WEB_PORT}`,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "demo-admin",
  ADMIN_SECRET: process.env.ADMIN_SECRET ?? "demo-secret-only-for-local-stand-0001",
};

function run(cmd, args, label) {
  console.log(`→ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) { console.error(`Не получилось: ${label}`); process.exit(r.status ?? 1); }
}

run("npx", ["prisma", "db", "push", "--skip-generate"], "Схема базы");
run("npx", ["tsx", "prisma/seed.ts"], "Демо-данные (Казань, вымышленные провайдеры)");
run("npx", ["next", "build"], "Сборка сайта");

const web = spawn("npx", ["next", "start", "-p", String(WEB_PORT), "-H", "127.0.0.1"], { cwd: root, env, stdio: "inherit" });
console.log(`\nГотово: http://127.0.0.1:${WEB_PORT}\nАдминка: /admin, пароль ${env.ADMIN_PASSWORD}\nОстановить — Ctrl+C.\n`);

const stop = async () => { web.kill(); try { await pg.stop(); } catch { /* ignore */ } process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.on("exit", stop);
