import { CsvImport } from "./CsvImport";

export function CoverageImport() {
  return (
    <CsvImport
      endpoint="/api/admin/coverage/import"
      title="Импорт покрытия из CSV"
      hint={
        <>
          Колонки: <code>city, street, house, provider</code> (обязательные) +{" "}
          <code>provider_name, tech, payout, source</code> (необязательные; имя и ставка
          применяются только к новому провайдеру). Повторный импорт безопасен — дубли не
          создаются, существующие записи освежаются.
        </>
      }
      stats={[
        { key: "rows", label: "Строк" },
        { key: "coverageCreated", label: "Добавлено", tone: "good" },
        { key: "coverageUpdated", label: "Обновлено", tone: "muted" },
        { key: "buildingsCreated", label: "Домов создано" },
        { key: "providersCreated", label: "Провайдеров создано" },
      ]}
    />
  );
}
