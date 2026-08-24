// Аутентификация админки. Edge-safe: только Web Crypto + env (работает и в middleware).
// Пароль задаётся через ADMIN_PASSWORD. В dev есть дефолт "admin"; в проде
// незаданная переменная — это ошибка (fail-fast), чтобы прод не поднялся с
// общеизвестным дефолтным паролем/секретом.
// В cookie кладём не пароль, а его хеш с секретом — middleware сверяет хеш.
//
// Сравнения — постоянного времени (timingSafeEqualHex): и логин, и проверка
// cookie не должны утекать посимвольно через тайминг. Node'овский
// crypto.timingSafeEqual здесь использовать НЕЛЬЗЯ — этот модуль тянется в
// middleware (Edge Runtime), где из node:crypto ничего не полифилится
// (поддержаны только buffer/events/assert/util/async_hooks), и сборка бы
// упала. Поэтому constant-time сверяем вручную над hex-дайджестами фиксированной
// длины — ту же гарантию (нет ветвления по данным) даёт и timingSafeEqual.

export const ADMIN_COOKIE = "admin_session";

function getPassword(): string {
  const v = process.env.ADMIN_PASSWORD;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD не задан — обязателен в production");
  }
  return "admin";
}

function getSecret(): string {
  const v = process.env.ADMIN_SECRET;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SECRET не задан — обязателен в production");
  }
  return "tarify-admin-secret";
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Сравнение двух hex-строк за постоянное время.
 * Длина hex-дайджеста фиксирована и секретом не является, поэтому расхождение
 * длины возвращаем сразу; содержимое сверяем без ветвления по данным (XOR-накопление) —
 * ровно так, как это делает crypto.timingSafeEqual, но Edge-safe.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Значение сессионной cookie для текущего пароля.
export async function sessionToken(): Promise<string> {
  return sha256hex(`${getPassword()}:${getSecret()}`);
}

export async function checkPassword(input: string): Promise<boolean> {
  // Хешируем оба значения и сверяем дайджесты постоянного времени: сравнение не
  // зависит ни от содержимого, ни от длины введённого пароля.
  const [inputHash, passHash] = await Promise.all([sha256hex(input), sha256hex(getPassword())]);
  return timingSafeEqualHex(inputHash, passHash);
}

// Проверка сессионной cookie постоянного времени — используется в middleware.
export async function verifySession(cookieValue: string | undefined | null): Promise<boolean> {
  if (!cookieValue) return false;
  return timingSafeEqualHex(cookieValue, await sessionToken());
}
