import Link from "next/link";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { CoverageImport } from "@/components/CoverageImport";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

// Админка покрытия: статистика матрицы «дом × провайдер» + импорт CSV.
export default async function CoveragePage() {
  const [cities, streets, buildings, coverage, providers, sources, freshness] = await Promise.all([
    prisma.city.count(),
    prisma.street.count(),
    prisma.building.count(),
    prisma.coverage.count(),
    prisma.provider.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { coverage: true } } },
    }),
    prisma.coverage.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.coverage.aggregate({ _min: { updatedAt: true }, _max: { updatedAt: true } }),
  ]);

  const fmtDate = (d: Date | null) => (d ? d.toLocaleString("ru-RU") : "—");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          <Link href="/admin/leads" className="hover:text-brand">
            Заявки
          </Link>{" "}
          / Покрытие
        </span>
        <LogoutButton />
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Покрытие</h1>
      <p className="mt-1 text-sm text-slate-500">
        Матрица «дом × провайдер» — главный актив платформы. Загружайте фиды провайдеров или
        ручной сбор в формате CSV.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Городов" value={cities} />
        <Stat label="Улиц" value={streets} />
        <Stat label="Домов" value={buildings} />
        <Stat label="Записей покрытия" value={coverage} highlight />
      </div>

      <div className="mt-6">
        <CoverageImport />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Источники и свежесть
      </h2>
      <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="text-slate-600">
          Обновлялось: с <b>{fmtDate(freshness._min.updatedAt)}</b> по{" "}
          <b>{fmtDate(freshness._max.updatedAt)}</b>. Поддержание свежести матрицы — ключевая
          операционная задача (готового API покрытия по РФ нет).
        </p>
        {sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {sources.map((s) => (
              <span
                key={s.source ?? "—"}
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600"
              >
                {s.source ?? "без источника"}: <b>{s._count._all}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Покрытие по провайдерам
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Провайдер</th>
              <th className="px-3 py-2">Домов в покрытии</th>
              <th className="px-3 py-2">CPA, ₽</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">
                  {p._count.coverage}{" "}
                  <span className="text-slate-400">
                    {plural(p._count.coverage, "дом", "дома", "домов")}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{p.payoutRub ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-brand/30 bg-brand/5" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-2xl font-bold ${highlight ? "text-brand" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
