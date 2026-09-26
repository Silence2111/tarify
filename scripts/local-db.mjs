// Локальный PostgreSQL без установки в систему (нативный arm64-бинарник из embedded-postgres).
// Данные кластера лежат в ./.pgdata (gitignored). Сервер держится живым, пока скрипт работает.
// Запуск: node scripts/local-db.mjs   (или npm run db:local)
// Строка подключения: postgresql://postgres:postgres@localhost:5433/tarify
import pkg from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createConnection } from "node:net";

/** Занят ли порт: проверка для понятного сообщения об ошибке. */
function portTaken(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: "127.0.0.1" });
    sock.on("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, 500);
  });
}

const EmbeddedPostgres = pkg.default ?? pkg;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, ".pgdata");

// Порт задаётся переменной: на машине уже может работать чужой Postgres
// на 5433 (например, от соседнего проекта), и тогда наш просто не поднимется.
const PORT = Number(process.env.PGPORT_LOCAL ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
});

const alreadyInit = existsSync(join(dataDir, "PG_VERSION"));
if (!alreadyInit) {
  console.log("initdb…");
  await pg.initialise();
}

// Без своей обработки занятый порт выглядит как «undefined» и стектрейс
// Node — по такому сообщению непонятно вообще ничего.
try {
  await pg.start();
} catch (e) {
  const busy = String(e?.message ?? e).includes("could not create any TCP/IP sockets");
  if (busy || (await portTaken(PORT))) {
    console.error(
      `Порт ${PORT} занят другим процессом — свой Postgres не поднялся.\n` +
        `Посмотреть, кто там: lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n` +
        `Запустить на другом порту: PGPORT_LOCAL=5434 npm run db:local\n` +
        `и не забыть поправить DATABASE_URL в .env`,
    );
  } else {
    console.error("Не удалось запустить локальный Postgres:", e?.message ?? e);
  }
  process.exit(1);
}

try {
  await pg.createDatabase("tarify");
  console.log("database 'tarify' created");
} catch (e) {
  console.log("createDatabase skipped:", e?.message ?? e);
}

console.log(`READY postgresql://postgres:postgres@localhost:${PORT}/tarify`);

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
