import { prisma } from "@/lib/db";
import { formatRub, plural } from "@/lib/format";
import { AdminNav } from "@/components/AdminNav";
import { PlansImport } from "@/components/PlansImport";

export const dynamic = "force-dynamic";

// Тарифы провайдеров. В поиск провайдер попадает, только если он включён, у него
// есть покрытие и хотя бы один активный тариф, — здесь видно, кому чего не хватает.
export default async function PlansPage() {
  const providers = await prisma.provider.findMany({
    orderBy: { name: "asc" },
    include: {
      plans: { orderBy: [{ isActive: "desc" }, { priceMonthly: "asc" }] },
      _count: { select: { coverage: true } },
    },
  });

  const rows = providers.map((p) => {
    const active = p.plans.filter((pl) => pl.isActive).length;
    const problems = [
      !p.isActive && "провайдер выключен",
      p._count.coverage === 0 && "нет покрытия",
      active === 0 && "нет активных тарифов",
    ].filter(Boolean);
    return { ...p, active, problems };
  });
  const activePlans = rows.reduce((n, p) => n + p.active, 0);
  const hiddenPlans = rows.reduce((n, p) => n + p.plans.length - p.active, 0);
  const visible = rows.filter((p) => p.problems.length === 0).length;

  return (
    <div>
      <AdminNav current="/admin/plans" />

      <h1 className="text-2xl font-bold text-slate-900">Тарифы</h1>
      <p className="mt-1 text-sm text-slate-500">
        Провайдер виден в поиске, только если у него есть покрытие и хотя бы один активный тариф.
        Тарифы загружаются CSV-прайсом: что в файле — то и на сайте.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Провайдеров" value={providers.length} />
        <Stat label="Видны в поиске" value={visible} highlight />
        <Stat label="Активных тарифов" value={activePlans} />
        <Stat label="Скрытых тарифов" value={hiddenPlans} />
      </div>

      <div className="mt-6">
        <PlansImport />
      </div>

      <div className="mt-8 space-y-6">
        {rows.map((p) => (
          <section key={p.id}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold text-slate-800">{p.name}</h2>
              <span className="text-xs text-slate-400">
                {p.slug} · CPA {p.payoutRub != null ? formatRub(p.payoutRub) : "—"} ·{" "}
                {p._count.coverage} {plural(p._count.coverage, "дом", "дома", "домов")} в покрытии
              </span>
              {p.problems.length > 0 ? (
                <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  не виден в поиске: {p.problems.join(", ")}
                </span>
              ) : (
                <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  в поиске
                </span>
              )}
            </div>

            {p.plans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Тарифов нет — загрузите прайс провайдера CSV-файлом.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Тариф</th>
                      <th className="px-3 py-2">Цена</th>
                      <th className="px-3 py-2">Скорость</th>
                      <th className="px-3 py-2">ТВ / моб.</th>
                      <th className="px-3 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.plans.map((pl) => (
                      <tr
                        key={pl.id}
                        className={`border-t border-slate-100 ${pl.isActive ? "" : "text-slate-400"}`}
                      >
                        <td className="px-3 py-2">{pl.name}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatRub(pl.priceMonthly)}
                          {pl.priceFirst != null && pl.priceFirst < pl.priceMonthly && (
                            <span className="text-xs text-green-600">
                              {" "}
                              · 1-й мес. {formatRub(pl.priceFirst)}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {pl.speedMbps != null ? `${pl.speedMbps} Мбит/с` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {[
                            pl.hasTv && `ТВ${pl.tvChannels ? ` · ${pl.tvChannels} кан.` : ""}`,
                            pl.hasMobile && `моб.${pl.mobileGb ? ` · ${pl.mobileGb} ГБ` : ""}`,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2">{pl.isActive ? "активен" : "скрыт"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
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
