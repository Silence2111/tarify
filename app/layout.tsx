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
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand">
              Тарифы<span className="text-brand-light">.ру</span>
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              <Link href="/" className="hover:text-brand">
                Интернет по адресу
              </Link>
              <Link href="/mobile" className="hover:text-brand">
                Мобильная связь
              </Link>
              <Link href="/business" className="hover:text-brand">
                Для бизнеса
              </Link>
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
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/izmeneniya-cen" className="hover:text-brand">
                Изменения цен
              </Link>
              <Link href="/privacy" className="hover:text-brand">
                Политика конфиденциальности
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
