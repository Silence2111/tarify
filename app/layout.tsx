import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { DemoBanner } from "@/components/DemoBanner";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Тарифы — интернет-провайдеры по адресу",
    template: "%s — Тарифы",
  },
  description:
    "Сравните тарифы интернет-провайдеров, доступных по вашему адресу. Подбор и подключение — бесплатно.",
  keywords: [
    "интернет провайдеры по адресу",
    "тарифы на интернет",
    "подключить интернет",
    "сравнение провайдеров",
    "домашний интернет и ТВ",
  ],
  openGraph: {
    type: "website",
    siteName: "Тарифы",
    title: "Тарифы — интернет-провайдеры по адресу",
    description:
      "Сравните тарифы интернет-провайдеров, доступных по вашему адресу. Бесплатно и без наценки.",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary",
    title: "Тарифы — интернет-провайдеры по адресу",
    description: "Сравните тарифы провайдеров по вашему адресу. Бесплатно.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Analytics />
        <DemoBanner />
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand">
              Тарифы<span className="text-brand-light">.ру</span>
            </Link>
            <nav className="text-sm text-slate-500">
              <span>Подбор интернета по адресу</span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-slate-400">
            <span>
              Сравнение бесплатно для пользователя — мы получаем вознаграждение от провайдеров за
              подключение.
            </span>
            <Link href="/privacy" className="hover:text-brand">
              Политика конфиденциальности
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
