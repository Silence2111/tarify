// Аутентификация админки. Edge-safe: только Web Crypto + env (работает и в middleware).
// Пароль задаётся через ADMIN_PASSWORD (по умолчанию "admin" для dev — ОБЯЗАТЕЛЬНО сменить в проде).
// В cookie кладём не пароль, а его хеш с секретом — middleware сверяет хеш.

export const ADMIN_COOKIE = "admin_session";

function getPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin";
}

function getSecret(): string {
  return process.env.ADMIN_SECRET || "tarify-admin-secret";
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Значение сессионной cookie для текущего пароля.
export async function sessionToken(): Promise<string> {
  return sha256hex(`${getPassword()}:${getSecret()}`);
}

export async function checkPassword(input: string): Promise<boolean> {
  return input === getPassword();
}
