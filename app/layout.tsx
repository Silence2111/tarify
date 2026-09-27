import type { Metadata } from "next";
import Link from "next/link";
import { Golos_Text } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { DemoBanner } from "@/components/DemoBanner";
import { Analytics } from "@/components/Analytics";

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-golos",
  display: "swap",
});

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
    <html lang="ru" className={golos.variable}>
      <body className="font-sans">
        <Analytics />
        <DemoBanner />
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4">
            <Link href="/" className="inline-flex min-h-[56px] items-center text-lg font-semibold text-ink">
              Тарифы
            </Link>
            <span className="text-sm text-ink-2">Домашний интернет по адресу</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">{children}</main>
        <footer className="mt-16 border-t border-line bg-panel">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-ink-2">
            <span>
              Подбор бесплатный: вознаграждение платит провайдер за подключение.
            </span>
            <nav className="flex gap-4">
              <Link href="/privacy" className="inline-flex min-h-[44px] items-center hover:text-brand-text">
                Обработка данных
              </Link>
              <Link href="/kontakty" className="inline-flex min-h-[44px] items-center hover:text-brand-text">
                Контакты
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
