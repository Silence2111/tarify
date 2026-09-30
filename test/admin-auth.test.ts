import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, login, timingSafeEqualHex, verifySession } from "@/lib/admin-auth";

/**
 * Аутентификация админки. Ключевые требования: прод не пускает под общеизвестным
 * паролем/секретом, а пароль владельца лежит в публичном репозитории только хэшем —
 * сам хэш админку не открывает.
 */

// Переменные читаются при каждом вызове, поэтому окружение подменяем через
// vi.stubEnv и откатываем после каждого теста.
afterEach(() => {
  vi.unstubAllEnvs();
});

function env(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

// Мало итераций — чтобы тесты шли быстро; формат и проверка те же.
const testHash = (password: string) => hashPassword(password, 1000);

describe("вход по хэшу пароля", () => {
  it("верный пароль даёт cookie, её принимает middleware — и без ADMIN_SECRET", async () => {
    env({
      NODE_ENV: "production",
      ADMIN_PASSWORD_HASH: await testHash("верный пароль"),
      ADMIN_PASSWORD: undefined,
      ADMIN_SECRET: undefined,
    });
    const token = await login("верный пароль");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifySession(token)).toBe(true);
    expect(await login("неверный пароль")).toBeNull();
    expect(await login("")).toBeNull();
  });

  it("хэш не открывает админку ни как пароль, ни как cookie", async () => {
    const hash = await testHash("пароль");
    env({ NODE_ENV: "production", ADMIN_PASSWORD_HASH: hash, ADMIN_PASSWORD: undefined });
    expect(await login(hash)).toBeNull();
    expect(await verifySession(hash)).toBe(false);
    expect(await verifySession(hash.split(":")[3])).toBe(false);
  });

  it("формат pbkdf2:итерации:соль:проверка, соль случайная", async () => {
    const hash = await testHash("пароль");
    expect(hash).toMatch(/^pbkdf2:1000:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await testHash("пароль")).not.toBe(hash);
  });

  it("битый ADMIN_PASSWORD_HASH — ошибка, а не молчаливый отказ", async () => {
    env({ ADMIN_PASSWORD_HASH: "pbkdf2_sha256$600000$соль$хэш" });
    await expect(login("пароль")).rejects.toThrow(/ADMIN_PASSWORD_HASH/);
    await expect(verifySession("cookie")).rejects.toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it("хэш владельца в коде корректен, а «admin» в проде не подходит", async () => {
    env({
      NODE_ENV: "production",
      ADMIN_PASSWORD_HASH: undefined,
      ADMIN_PASSWORD: undefined,
      ADMIN_SECRET: undefined,
    });
    expect(await login("admin")).toBeNull();
  });
});

describe("вход по ADMIN_PASSWORD", () => {
  it("в production без ADMIN_SECRET — ошибка, а не дефолтный секрет", async () => {
    env({
      NODE_ENV: "production",
      ADMIN_PASSWORD_HASH: await testHash("другой пароль"),
      ADMIN_PASSWORD: "какой-то-пароль",
      ADMIN_SECRET: undefined,
    });
    await expect(login("какой-то-пароль")).rejects.toThrow(/ADMIN_SECRET/);
    // Cookie с общеизвестным dev-секретом не пускает — и middleware не падает.
    const devCookie = createHash("sha256").update("какой-то-пароль:tarify-admin-secret").digest("hex");
    expect(await verifySession(devCookie)).toBe(false);
    // Пароль по хэшу работает и при этом.
    expect(await verifySession(await login("другой пароль"))).toBe(true);
  });

  it("в production с ADMIN_SECRET — работает вместе с паролем по хэшу", async () => {
    env({
      NODE_ENV: "production",
      ADMIN_PASSWORD_HASH: await testHash("другой пароль"),
      ADMIN_PASSWORD: "s3cret",
      ADMIN_SECRET: "salt",
    });
    const token = await login("s3cret");
    expect(token).not.toBeNull();
    expect(await verifySession(token)).toBe(true);
    expect(await login("wrong")).toBeNull();
    expect(await login("другой пароль")).not.toBeNull();
  });

  it("в dev без переменных — дефолт admin (обратная совместимость)", async () => {
    env({
      NODE_ENV: "development",
      ADMIN_PASSWORD_HASH: await testHash("другой пароль"),
      ADMIN_PASSWORD: undefined,
      ADMIN_SECRET: undefined,
    });
    expect(await verifySession(await login("admin"))).toBe(true);
  });
});

describe("constant-time сравнение", () => {
  it("равные hex-строки — true, разные — false", () => {
    expect(timingSafeEqualHex("deadbeef", "deadbeef")).toBe(true);
    expect(timingSafeEqualHex("deadbeef", "deadbeee")).toBe(false);
  });

  it("разная длина — false, без падения", () => {
    expect(timingSafeEqualHex("ab", "abcd")).toBe(false);
    expect(timingSafeEqualHex("", "ab")).toBe(false);
  });

  it("verifySession отвергает чужую и пустую cookie", async () => {
    env({ NODE_ENV: "development", ADMIN_PASSWORD: "s3cret", ADMIN_SECRET: "salt" });
    expect(await verifySession("deadbeef")).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
    expect(await verifySession("")).toBe(false);
  });
});
