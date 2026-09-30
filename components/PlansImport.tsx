import { CsvImport } from "./CsvImport";

export function PlansImport() {
  return (
    <CsvImport
      endpoint="/api/admin/plans/import"
      title="Импорт тарифов из CSV"
      hint={
        <>
          Колонки: <code>provider, plan, price</code> (обязательные) +{" "}
          <code>
            provider_name, payout, price_first, speed, tv, gb, minutes, sms, esim, region, url,
            erid, type, description, options
          </code>
          . Файл — актуальный прайс пары «провайдер + регион»: её тарифы, которых в нём нет,
          скрываются с сайта. При ошибке в любой строке не загружается ничего. Формат и шаблоны —{" "}
          <code>data/PLANS.md</code>.
        </>
      }
      stats={[
        { key: "rows", label: "Тарифов в файле" },
        { key: "plansCreated", label: "Добавлено", tone: "good" },
        { key: "plansUpdated", label: "Обновлено", tone: "muted" },
        { key: "plansHidden", label: "Скрыто" },
        { key: "providersCreated", label: "Провайдеров создано" },
      ]}
    />
  );
}
