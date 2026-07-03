import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, sessionToken } from "@/lib/admin-auth";

// Защищаем админку и admin-API. Открыты: сама страница логина и его API.
// Под защитой: /admin/*, /api/admin/* и смена статуса заявки /api/leads/:id (PATCH).
// Публичны: создание заявки POST /api/leads (без id) и автокомплит /api/streets.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const expected = await sessionToken();
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie && cookie === expected) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/leads/:id"],
};
