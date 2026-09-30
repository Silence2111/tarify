import { AdminNav } from "@/components/AdminNav";
import { DemoCleanupButton } from "@/components/DemoCleanupButton";
import { prisma } from "@/lib/db";
import { getDemoCounts, SEED_SOURCE } from "@/lib/demo";
import { demoSummary, launchChecks, launchProgress, type Check } from "@/lib/launch";
import { HOME_PLAN_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

// Переменные, от которых зависит чек-лист. Значения на страницу не выводятся —
// только «задана или нет» (адрес сайта и получатели данных и так публичны).
const ENV_KEYS = [
  "DIRECT_URL",
  "NEXT_PUBLIC_SITE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_DEMO",
  "POSTBACK_TOKEN",
  "LEAD_WEBHOOK_URL",
  "OPERATOR_NAME",
  "OPERATOR_INN",
  "OPERATOR_OGRN",
  "OPERATOR_ADDRESS",
  "OPERATOR_EMAIL",
  "PD_RECIPIENTS",
  "NEXT_PUBLIC_YANDEX_METRIKA_ID",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_LEADS_CHAT_ID",
  "TELEGRAM_CHANNEL_ID",
] as const;

const STATUS = {
  ok: { label: "готово", cls: "bg-green-100 text-green-800" },
  todo: { label: "нужно сделать", cls: "bg-amber-100 text-amber-800" },
  optional: { label: "по желанию", cls: "bg-slate-100 text-slate-600" },
  manual: { label: "проверьте сами", cls: "bg-sky-100 text-sky-800" },
} as const;

const imported = { importedAt: { not: null }, isActive: true };
const noSubid = [
  { NOT: { url: { contains: "{subid}" } } },
  { NOT: { url: { contains: "%7Bsubid%7D", mode: "insensitive" as const } } },
];

// Чек-лист запуска: что уже готово на этом сайте и что осталось — из переменных
// окружения и базы. Здесь же — очистка демо-данных перед запуском.
export default async function LaunchPage() {
  const [demo, home, mobile, business, realCoverage, partnerLinks, linksWithoutSubid, clicks, leads] =
    await Promise.all([
      getDemoCounts(),
      prisma.plan.count({ where: { ...imported, type: { in: [...HOME_PLAN_TYPES] } } }),
      prisma.plan.count({ where: { ...imported, type: "MOBILE" } }),
      prisma.plan.count({ where: { ...imported, type: "BUSINESS_ACCOUNT" } }),
      prisma.coverage.count({ where: { OR: [{ source: null }, { source: { not: SEED_SOURCE } }] } }),
      prisma.plan.count({ where: { ...imported, url: { not: null } } }),
      prisma.plan.count({ where: { ...imported, url: { not: null }, AND: noSubid } }),
      prisma.click.count({ where: { status: { not: null } } }),
      prisma.lead.count({ where: { networkStatus: { not: null } } }),
    ]);

  const env = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const groups = launchChecks({
    env,
    demo,
    realPlans: { home, mobile, business },
    realCoverage,
    partnerLinks,
    linksWithoutSubid,
    networkStatuses: clicks + leads,
  });
  const progress = launchProgress(groups);
  const demoLeft = demo.coverage + demo.plans > 0;

  return (
    <div>
      <AdminNav current="/admin/launch" />

      <h1 className="text-2xl font-bold text-slate-900">Запуск</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Что уже готово на этом сайте и что осталось до приёма настоящих заявок. Пункты
        проверяются по переменным окружения в Vercel и данным в базе; после изменения переменных
        нужен redeploy.
      </p>
      <p className="mt-3 text-lg font-semibold text-slate-800">
        Готово {progress.done} из {progress.total}
      </p>

      <div className="mt-4 space-y-6">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{g.title}</h2>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {g.checks.map((c) => (
                <li key={c.title} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                  <Badge check={c} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">{c.title}</div>
                    <div className="break-words text-xs text-slate-500">{c.hint}</div>
                    {c.title === "Демо-данные убраны" && (
                      <DemoCleanupButton
                        available={demoLeft}
                        summary={`${demoSummary(demo)} Дома, улицы и города без другого покрытия удалятся, демо-тарифы — скроются.`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Badge({ check }: { check: Check }) {
  const s = check.status === "todo" && check.optional ? STATUS.optional : STATUS[check.status];
  return (
    <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}
