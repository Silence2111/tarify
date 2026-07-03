// Локальный PostgreSQL без установки в систему (нативный arm64-бинарник из embedded-postgres).
// Данные кластера лежат в ./.pgdata (gitignored). Сервер держится живым, пока скрипт работает.
// Запуск: node scripts/local-db.mjs   (или npm run db:local)
// Строка подключения: postgresql://postgres:postgres@localhost:5433/tarify
import pkg from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const EmbeddedPostgres = pkg.default ?? pkg;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
});

const alreadyInit = existsSync(join(dataDir, "PG_VERSION"));
if (!alreadyInit) {
  console.log("initdb…");
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase("tarify");
  console.log("database 'tarify' created");
} catch (e) {
  console.log("createDatabase skipped:", e?.message ?? e);
}

console.log("READY postgresql://postgres:postgres@localhost:5433/tarify");

// Держим процесс живым, чтобы к БД мог подключаться dev-сервер.
process.stdin.resume();
const shutdown = async () => {
  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
