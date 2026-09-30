import { prisma } from "@/lib/db";
import { amountText } from "@/lib/catalog-filter";
import { formatRub, plural } from "@/lib/format";
import { HOME_PLAN_TYPES, type PlanType } from "@/lib/types";
import { AdminNav } from "@/components/AdminNav";
import { PlansImport } from "@/components/PlansImport";
import { isDemo } from "@/lib/site";

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
// Провайдеры свёрнуты: в заголовке видно, есть ли провайдер на сайте и почему нет,
// тарифы — списком, а не таблицей, чтобы читалось и с телефона.
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
        Тарифы загружаются CSV-прайсом: что в файле — то и на сайте. В поиск по адресу провайдер
        попадает, только если у него есть покрытие и активный домашний тариф; мобильной связи и
        счетам для бизнеса покрытие не нужно. Изменения цен попадают в{" "}
        <a href="/izmeneniya-cen" className="text-brand hover:underline">
          ленту
        </a>
        {process.env.TELEGRAM_CHANNEL_ID && process.env.TELEGRAM_BOT_TOKEN
          ? ` и в Telegram-канал ${process.env.TELEGRAM_CHANNEL_ID}.`
          : "."}
        {isDemo() &&
          " Пока включён демо-режим, изменения цен не записываются: первый реальный прайс поверх демо-тарифов — не новость. Как выключить — в «Запуске»."}
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

      <div className="mt-8 space-y-2">
        {rows.map((p) => (
          <details key={p.id} className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="text-xs text-slate-400">
                    активных {p.active} из {p.plans.length}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
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
              </div>
              <span className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden>
                ▾
              </span>
            </summary>

            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              Код в прайсе: <code>{p.slug}</code> · CPA{" "}
              {p.payoutRub != null ? formatRub(p.payoutRub) : "—"} · {p._count.coverage}{" "}
              {plural(p._count.coverage, "дом", "дома", "домов")} в покрытии
            </div>
            {p.plans.length === 0 ? (
              <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                Тарифов нет — загрузите прайс провайдера CSV-файлом.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {p.plans.map((pl) => (
                  <li
                    key={pl.id}
                    className={`flex items-start justify-between gap-3 px-4 py-2.5 text-sm ${
                      pl.isActive ? "" : "text-slate-400"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={pl.isActive ? "text-slate-800" : ""}>
                        {pl.name}
                        {pl.url && <span className="text-xs text-slate-400"> · ссылка</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[
                          TYPE_LABEL[pl.type],
                          pl.region ?? (pl.type === "MOBILE" ? "вся Россия" : null),
                          composition(pl),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="whitespace-nowrap">{formatRub(pl.priceMonthly)}</div>
                      {pl.priceFirst != null && pl.priceFirst < pl.priceMonthly && (
                        <div className="whitespace-nowrap text-xs text-green-600">
                          1-й мес. {formatRub(pl.priceFirst)}
                        </div>
                      )}
                      {!pl.isActive && <div className="text-xs">скрыт</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

// Короткий состав тарифа: скорость, ТВ, гигабайты, минуты, eSIM.
function composition(pl: {
  speedMbps: number | null;
  hasTv: boolean;
  tvChannels: number | null;
  mobileGb: number | null;
  minutes: number | null;
  esim: boolean;
}): string | null {
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
      .join(", ") || null
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
