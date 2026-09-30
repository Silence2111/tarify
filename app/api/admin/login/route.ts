import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, login } from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Защита от подбора пароля: 10 попыток с IP за 5 минут.
  const rl = await rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток входа, попробуйте позже" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let password = "";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { password?: unknown };
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const form = await req.formData();
      password = String(form.get("password") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let token: string | null;
  try {
    token = await login(password);
  } catch (e) {
    // Ошибка настройки (битый ADMIN_PASSWORD_HASH, нет ADMIN_SECRET): подробности — в лог,
    // а на странице входа — что вход не настроен, а не «Неверный пароль».
    console.error("[admin login]", e);
    return NextResponse.json(
      { error: "Вход не настроен — подробности в логах сервера" },
      { status: 500 },
    );
  }
  if (!token) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // под HTTPS в проде
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  });
  return res;
}
