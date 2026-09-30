import { prisma } from "@/lib/db";
import { amountText } from "@/lib/catalog-filter";
import { formatRub, plural } from "@/lib/format";
import { HOME_PLAN_TYPES, type PlanType } from "@/lib/types";
import { AdminNav } from "@/components/AdminNav";
import { PlansImport } from "@/components/PlansImport";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<PlanType, string> = {
  INTERNET: "интернет",
  TV: "ТВ",
  BUNDLE: "пакет",
  MOBILE: "мобильная",
  BUSINESS_ACCOUNT: "счёт",
};

const isHome = (t: PlanType) => (HOME_PLAN_TYPES as readonly PlanType[]).includes(t);

// Тарифы провайдеров и где провайдер виден на сайте. В поиск по адресу нужен
// включённый провайдер с покрытием и активным домашним тарифом; в каталоги
// мобильной связи и счетов для бизнеса — с активным тарифом этого типа.
export default async function PlansPage() {
  const providers = await prisma.provider.findMany({
    orderBy: { name: "asc" },
    include: {
      plans: {
        orderBy: [{ isActive: "desc" }, { type: "asc" }, { region: "asc" }, { priceMonthly: "asc" }],
      },
      _count: { select: { coverage: true } },
    },
  });

  const rows = providers.map((p) => {
    const active = p.plans.filter((pl) => pl.isActive);
    const home = active.filter((pl) => isHome(pl.type)).length;
    const mobile = active.filter((pl) => pl.type === "MOBILE").length;
    const business = active.filter((pl) => pl.type === "BUSINESS_ACCOUNT").length;
    const covered = p._count.coverage > 0;
    const places = p.isActive
      ? [
          home > 0 && covered && "поиск по адресу",
          mobile > 0 && "мобильная связь",
          business > 0 && "для бизнеса",
        ].filter((x): x is string => Boolean(x))
      : [];
    const problems = [
      !p.isActive && "провайдер выключен",
      active.length === 0 && "нет активных тарифов",
      home > 0 && !covered && "домашние тарифы без покрытия",
      covered && home === 0 && "покрытие есть, домашних тарифов нет",
    ].filter((x): x is string => Boolean(x));
    return { ...p, active: active.length, places, problems };
  });
  const activePlans = rows.reduce((n, p) => n + p.active, 0);
  const hiddenPlans = rows.reduce((n, p) => n + p.plans.length - p.active, 0);
  const visible = rows.filter((p) => p.places.length > 0).length;

  return (
    <div>
      <AdminNav current="/admin/plans" />

      <h1 className="text-2xl font-bold text-slate-900">Тарифы</h1>
      <p className="mt-1 text-sm text-slate-500">
        В поиск по адресу провайдер попадает, только если у него есть покрытие и активный домашний
        тариф. Мобильная связь и счета для бизнеса покрытия не требуют. Тарифы загружаются
        CSV-прайсом: что в файле — то и на сайте.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Провайдеров" value={providers.length} />
        <Stat label="Видны на сайте" value={visible} highlight />
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
              {p.places.length > 0 && (
                <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  на сайте: {p.places.join(", ")}
                </span>
              )}
              {p.problems.length > 0 && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    p.places.length > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {p.places.length > 0 ? "" : "не виден на сайте: "}
                  {p.problems.join(", ")}
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
                      <th className="px-3 py-2">Тип</th>
                      <th className="px-3 py-2">Регион</th>
                      <th className="px-3 py-2">Цена</th>
                      <th className="px-3 py-2">Состав</th>
                      <th className="px-3 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.plans.map((pl) => (
                      <tr
                        key={pl.id}
                        className={`border-t border-slate-100 ${pl.isActive ? "" : "text-slate-400"}`}
                      >
                        <td className="px-3 py-2">
                          {pl.name}
                          {pl.url && <span className="ml-1 text-xs text-slate-400">· ссылка</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{TYPE_LABEL[pl.type]}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {pl.region ?? (pl.type === "MOBILE" ? "вся Россия" : "—")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatRub(pl.priceMonthly)}
                          {pl.priceFirst != null && pl.priceFirst < pl.priceMonthly && (
                            <span className="text-xs text-green-600">
                              {" "}
                              · 1-й мес. {formatRub(pl.priceFirst)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{composition(pl)}</td>
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

// Короткий состав тарифа для таблицы: скорость, ТВ, гигабайты, минуты, eSIM.
function composition(pl: {
  speedMbps: number | null;
  hasTv: boolean;
  tvChannels: number | null;
  mobileGb: number | null;
  minutes: number | null;
  esim: boolean;
}): string {
  const gb = amountText(pl.mobileGb, "ГБ");
  const minutes = amountText(pl.minutes, "мин");
  return (
    [
      pl.speedMbps != null && `${pl.speedMbps} Мбит/с`,
      pl.hasTv && `ТВ${pl.tvChannels ? ` · ${pl.tvChannels} кан.` : ""}`,
      gb && (gb === "безлимит" ? "безлимит ГБ" : gb),
      minutes && (minutes === "безлимит" ? "безлимит минут" : minutes),
      pl.esim && "eSIM",
    ]
      .filter(Boolean)
      .join(", ") || "—"
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
