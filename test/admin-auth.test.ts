import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPassword,
  sessionToken,
  timingSafeEqualHex,
  verifySession,
} from "@/lib/admin-auth";

/**
 * Аутентификация админки. Ключевое требование — прод не должен подниматься с
 * общеизвестным дефолтным паролем/секретом: незаданная переменная в production
 * обязана падать (fail-fast), а не молча пускать под "admin".
 */

// getPassword/getSecret читают process.env при каждом вызове, поэтому окружение
// подменяем через vi.stubEnv и откатываем после каждого теста.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fail-fast на незаданный пароль/секрет в проде", () => {
  it("в production без ADMIN_PASSWORD — ошибка, а не дефолт", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    vi.stubEnv("ADMIN_SECRET", "какой-то-секрет");
    await expect(checkPassword("admin")).rejects.toThrow(/ADMIN_PASSWORD/);
  });

  it("в production без ADMIN_SECRET — ошибка, а не дефолт", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "какой-то-пароль");
    vi.stubEnv("ADMIN_SECRET", undefined);
    await expect(sessionToken()).rejects.toThrow(/ADMIN_SECRET/);
  });

  it("в production с заданными переменными — работает", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "s3cret");
    vi.stubEnv("ADMIN_SECRET", "salt");
    expect(await checkPassword("s3cret")).toBe(true);
    expect(await checkPassword("wrong")).toBe(false);
  });

  it("в dev без переменных — дефолт остаётся (обратная совместимость)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    vi.stubEnv("ADMIN_SECRET", undefined);
    expect(await checkPassword("admin")).toBe(true);
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

  it("verifySession принимает валидную cookie и отвергает чужую/пустую", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_PASSWORD", "s3cret");
    vi.stubEnv("ADMIN_SECRET", "salt");
    const token = await sessionToken();
    expect(await verifySession(token)).toBe(true);
    expect(await verifySession("deadbeef")).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
    expect(await verifySession("")).toBe(false);
  });
});
