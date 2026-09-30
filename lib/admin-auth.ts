// Аутентификация админки. Edge-safe: только Web Crypto + env (работает и в middleware).
//
// Войти можно любым из двух паролей:
// 1) по хэшу — ADMIN_PASSWORD_HASH, а если переменная не задана, хэш пароля владельца
//    этого сайта из константы ниже (npm run admin:password). Сам пароль по хэшу не
//    восстановить, поэтому хэш может лежать в публичном репозитории;
// 2) ADMIN_PASSWORD открытым текстом — вместе с ADMIN_SECRET. В dev без неё пароль
//    "admin"; в проде дефолта нет, а без ADMIN_SECRET вход по ней — ошибка (fail-fast),
//    чтобы прод не работал с общеизвестным секретом.
//
// Хэш: key = PBKDF2-SHA256(пароль, соль, итерации), в хэше хранится только SHA-256(key).
// После входа key и становится сессионной cookie: middleware сверяет её SHA-256 с хэшем —
// cookie проверяется без пароля и без секрета, а подделать её по хэшу нельзя. Для
// ADMIN_PASSWORD в cookie — хеш пароля с секретом, middleware считает его сам.
//
// Сравнения — постоянного времени (timingSafeEqualHex): и логин, и проверка
// cookie не должны утекать посимвольно через тайминг. Node'овский
// crypto.timingSafeEqual здесь использовать НЕЛЬЗЯ — этот модуль тянется в
// middleware (Edge Runtime), где из node:crypto ничего не полифилится
// (поддержаны только buffer/events/assert/util/async_hooks), и сборка бы
// упала. Поэтому constant-time сверяем вручную над hex-дайджестами фиксированной
// длины — ту же гарантию (нет ветвления по данным) даёт и timingSafeEqual.

export const ADMIN_COOKIE = "admin_session";

// Хэш пароля владельца этого сайта. Своя копия сайта — свой пароль: задайте
// ADMIN_PASSWORD_HASH или замените константу (npm run admin:password).
const OWNER_PASSWORD_HASH =
  "pbkdf2:600000:40b51b19ab209be71a5c57652ab2ec71:ef6353a63bad54616deb957e23c456426115d81eea0df2658cff4cd405e7618c";

const PBKDF2_ITERATIONS = 600_000; // рекомендация OWASP для PBKDF2-SHA256

type PasswordHash = { iterations: number; salt: Uint8Array<ArrayBuffer>; check: string };

function passwordHash(): PasswordHash {
  const raw = process.env.ADMIN_PASSWORD_HASH?.trim() || OWNER_PASSWORD_HASH;
  const m = /^pbkdf2:([1-9]\d*):([0-9a-f]{32}):([0-9a-f]{64})$/.exec(raw);
  if (!m) {
    throw new Error("ADMIN_PASSWORD_HASH: неверный формат — получите хэш командой npm run admin:password");
  }
  return { iterations: Number(m[1]), salt: fromHex(m[2]), check: m[3] };
}

function envPassword(): string | null {
  const v = process.env.ADMIN_PASSWORD;
  if (v) return v;
  return process.env.NODE_ENV === "production" ? null : "admin";
}

// В проде без ADMIN_SECRET — null: общеизвестного дефолта там нет, вход по
// ADMIN_PASSWORD выключен (login об этом сообщит ошибкой).
function getSecret(): string | null {
  const v = process.env.ADMIN_SECRET;
  if (v) return v;
  return process.env.NODE_ENV === "production" ? null : "tarify-admin-secret";
}

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function pbkdf2hex(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
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

/** Сравнение секретов произвольной длины за постоянное время (токен постбэка и т. п.). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256hex(a), sha256hex(b)]);
  return timingSafeEqualHex(ha, hb);
}

/**
 * Хэш пароля для ADMIN_PASSWORD_HASH: pbkdf2:итерации:соль:SHA-256(ключ). Без «$» —
 * его подставляют как переменную shell, .env-файлы Next.js и Docker Compose.
 */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await pbkdf2hex(password, salt, iterations);
  return `pbkdf2:${iterations}:${toHex(salt)}:${await sha256hex(key)}`;
}

// Cookie для входа по ADMIN_PASSWORD.
const envSessionToken = (password: string, secret: string) => sha256hex(`${password}:${secret}`);

/** Вход: при верном пароле — значение сессионной cookie, иначе null. */
export async function login(input: string): Promise<string | null> {
  if (!input) return null;
  const hash = passwordHash();
  const key = await pbkdf2hex(input, hash.salt, hash.iterations);
  if (timingSafeEqualHex(await sha256hex(key), hash.check)) return key;
  const password = envPassword();
  // safeEqual хеширует оба значения и сверяет дайджесты постоянного времени: сравнение
  // не зависит ни от содержимого, ни от длины введённого пароля.
  if (password === null || !(await safeEqual(input, password))) return null;
  const secret = getSecret();
  if (secret === null) {
    throw new Error("ADMIN_SECRET не задан — без него вход по ADMIN_PASSWORD в production не работает");
  }
  return envSessionToken(password, secret);
}

// Проверка сессионной cookie постоянного времени — используется в middleware.
export async function verifySession(cookieValue: string | undefined | null): Promise<boolean> {
  if (!cookieValue) return false;
  if (timingSafeEqualHex(await sha256hex(cookieValue), passwordHash().check)) return true;
  const password = envPassword();
  const secret = getSecret();
  if (password === null || secret === null) return false;
  return timingSafeEqualHex(cookieValue, await envSessionToken(password, secret));
}
