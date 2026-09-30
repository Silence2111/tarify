import { prisma } from "@/lib/db";
import { formatDateTime, formatRub, plural } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

const DAYS = 30;
const STATUS_LABEL = {
  PENDING: "в обработке",
  HOLD: "холд",
  APPROVED: "одобрено",
  REJECTED: "отклонено",
} as const;

// Переходы по партнёрским ссылкам («Оформить») и что по ним вернули CPA-сети.
// Заявки с обзвоном считаются в «Заявках»; здесь — доход без обзвона.
export default async function ClicksPage() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const [clicks, conversions, recent, providers] = await Promise.all([
    prisma.click.groupBy({
      by: ["providerId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.click.groupBy({
      by: ["providerId", "status"],
      where: { createdAt: { gte: since }, status: { not: null } },
      _count: { _all: true },
      _sum: { payoutRub: true },
    }),
    prisma.click.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { provider: { select: { name: true } }, plan: { select: { name: true } } },
    }),
    prisma.provider.findMany({ select: { id: true, name: true } }),
  ]);

  const names = new Map(providers.map((p) => [p.id, p.name]));
  const rows = clicks
    .map((c) => {
      const own = conversions.filter((x) => x.providerId === c.providerId);
      const sum = (status: keyof typeof STATUS_LABEL) =>
        own.find((x) => x.status === status)?._sum.payoutRub ?? 0;
      const count = (status: keyof typeof STATUS_LABEL) =>
        own.find((x) => x.status === status)?._count._all ?? 0;
      return {
        id: c.providerId,
        name: names.get(c.providerId) ?? "—",
        clicks: c._count._all,
        conversions: own.reduce((n, x) => n + x._count._all, 0),
        approved: count("APPROVED"),
        earned: sum("APPROVED"),
        hold: sum("HOLD"),
      };
    })
    .sort((a, b) => b.earned - a.earned || b.clicks - a.clicks);

  const total = rows.reduce(
    (t, r) => ({
      clicks: t.clicks + r.clicks,
      conversions: t.conversions + r.conversions,
      earned: t.earned + r.earned,
      hold: t.hold + r.hold,
    }),
    { clicks: 0, conversions: 0, earned: 0, hold: 0 },
  );
  const tokenSet = Boolean(process.env.POSTBACK_TOKEN);

  return (
    <div>
      <AdminNav current="/admin/clicks" />

      <h1 className="text-2xl font-bold text-slate-900">Переходы</h1>
      <p className="mt-1 text-sm text-slate-500">
        Нажатия «Оформить» по партнёрским ссылкам за {DAYS} дней и что по ним вернули CPA-сети.
        Заявки с обзвоном — в разделе «Заявки».
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Переходов" value={String(total.clicks)} />
        <Stat label="Конверсий" value={String(total.conversions)} />
        <Stat label="Заработано (одобрено)" value={formatRub(total.earned)} highlight />
        <Stat label="В холде" value={formatRub(total.hold)} />
      </div>

      <details open={!tokenSet} className="group mt-6 rounded-xl border border-slate-200 bg-white text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold text-slate-800">Как подключить постбэк</span>
          {tokenSet ? (
            <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              приём включён
            </span>
          ) : (
            <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              приём выключен
            </span>
          )}
          <span className="ml-auto text-slate-400 transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <ol className="list-inside list-decimal space-y-1 px-4 pb-4 text-slate-600">
          <li>
            В партнёрскую ссылку тарифа (колонка <code>url</code> в CSV) вставьте{" "}
            <code>{"{subid}"}</code> туда, куда сеть просит передавать метку, например{" "}
            <code>{"…&subid={subid}"}</code>.
          </li>
          <li>
            В кабинете сети укажите адрес постбэка, подставив макросы сети для метки, статуса и
            суммы:
            <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded bg-slate-50 px-2 py-1 text-xs">
              {`${siteUrl()}/api/postback?token=ТОКЕН&subid=МЕТКА&status=СТАТУС&payout=СУММА`}
            </code>
          </li>
          <li>
            Тот же адрес принимает статусы заявок с обзвоном: если передать заявку в сеть с её
            номером в метке, статус и сумма появятся в «Заявках».
          </li>
          <li>
            Токен — переменная <code>POSTBACK_TOKEN</code> в Vercel.{" "}
            {tokenSet ? (
              <span className="text-green-700">Задана — приём включён.</span>
            ) : (
              <span className="text-red-600">Не задана — приём выключен.</span>
            )}
          </li>
        </ol>
      </details>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        По операторам
      </h2>
      {rows.length === 0 ? (
        <Empty>Переходов пока нет</Empty>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-800">{r.name}</div>
                <div className="text-xs text-slate-500">
                  {r.clicks} {plural(r.clicks, "переход", "перехода", "переходов")} ·{" "}
                  {r.conversions} {plural(r.conversions, "конверсия", "конверсии", "конверсий")}
                  {r.clicks > 0 && ` (${Math.round((r.conversions / r.clicks) * 1000) / 10}%)`} ·
                  одобрено {r.approved}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-medium text-green-700">{formatRub(r.earned)}</div>
                {r.hold > 0 && (
                  <div className="text-xs text-slate-500">в холде {formatRub(r.hold)}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Последние {recent.length} {plural(recent.length, "переход", "перехода", "переходов")}
      </h2>
      {recent.length === 0 ? (
        <Empty>Переходов пока нет</Empty>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {recent.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="text-slate-800">
                  {c.provider.name}
                  {c.plan && <span className="text-slate-500"> · {c.plan.name}</span>}
                </div>
                <div className="break-words text-xs text-slate-400">
                  {formatDateTime(c.createdAt)}
                  {c.page && ` · ${c.page}`}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <div className={c.status === "APPROVED" ? "font-medium text-green-700" : "text-slate-500"}>
                  {c.status ? STATUS_LABEL[c.status] : "без статуса"}
                </div>
                {c.payoutRub != null && <div className="text-slate-700">{formatRub(c.payoutRub)}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-2xl font-bold ${highlight ? "text-green-700" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
