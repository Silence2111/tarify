import type { Metadata } from "next";
import Link from "next/link";
import { BusinessLeadForm } from "@/components/BusinessLeadForm";
import { CatalogList } from "@/components/CatalogList";
import { getCatalogPlans, getCatalogProviders, getCatalogUpdatedAt } from "@/lib/catalog";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Для бизнеса: интернет в офис и расчётные счета",
  description:
    "Подключение интернета и связи в офис по адресу и сравнение тарифов расчётных счетов для ИП и ООО.",
  alternates: { canonical: "/business" },
};

// Раздел для бизнеса. Интернет в офис — заявка с обзвоном (операторы платят
// процент от счёта клиента); расчётные счета — каталог с партнёрскими ссылками банков.
export default async function BusinessPage() {
  const [accounts, banks, updatedAt] = await Promise.all([
    getCatalogPlans("BUSINESS_ACCOUNT"),
    getCatalogProviders("BUSINESS_ACCOUNT"),
    getCatalogUpdatedAt("BUSINESS_ACCOUNT"),
  ]);

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        / Для бизнеса
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Для бизнеса</h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        Интернет и связь в офис, расчётный счёт для ИП и ООО. Подбор бесплатный: нам платят
        операторы и банки.
      </p>

      <section id="internet" className="mt-8">
        <h2 className="text-lg font-semibold text-slate-800">Интернет и связь в офис</h2>
        <p className="mb-3 mt-1 max-w-2xl text-sm text-slate-500">
          Оставьте адрес офиса: проверим, какие провайдеры заходят в здание, и пришлём тарифы для
          юрлиц — интернет, телефонию, Wi-Fi для гостей.
        </p>
        <BusinessLeadForm />
      </section>

      <section id="accounts" className="mt-10">
        <h2 className="text-lg font-semibold text-slate-800">Расчётные счета</h2>
        <p className="mb-3 mt-1 max-w-2xl text-sm text-slate-500">
          Сравните обслуживание, бесплатные платежи и снятие наличных. Счёт открывается на сайте
          банка.
          {updatedAt && ` Условия обновлены ${formatDate(updatedAt)}`}
        </p>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            Тарифов пока нет. Они появятся, когда в админке загрузят прайс банков.
          </div>
        ) : (
          <CatalogList
            plans={accounts}
            kind="business"
            providers={banks}
            actionLabel="Открыть счёт на сайте банка"
          />
        )}
      </section>

      <p className="mt-6 text-xs text-slate-400">
        Условия — по данным банков и операторов на момент загрузки, точные — на их сайтах. Мы
        получаем вознаграждение за открытие счёта и подключение; для вас цена та же.
      </p>
    </div>
  );
}
