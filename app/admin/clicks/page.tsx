import { prisma } from "@/lib/db";
import { formatRub, plural } from "@/lib/format";
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

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="font-semibold text-slate-800">Как подключить постбэк</div>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-600">
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
            Токен — переменная <code>POSTBACK_TOKEN</code> в Vercel.{" "}
            {tokenSet ? (
              <span className="text-green-700">Задана — приём включён.</span>
            ) : (
              <span className="text-red-600">Не задана — приём выключен.</span>
            )}
          </li>
        </ol>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        По операторам
      </h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Оператор</th>
              <th className="px-3 py-2">Переходы</th>
              <th className="px-3 py-2">Конверсии</th>
              <th className="px-3 py-2">Одобрено</th>
              <th className="px-3 py-2">Заработано</th>
              <th className="px-3 py-2">В холде</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Переходов пока нет
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.clicks}</td>
                  <td className="px-3 py-2">
                    {r.conversions}
                    {r.clicks > 0 && (
                      <span className="text-xs text-slate-400">
                        {" "}
                        · {Math.round((r.conversions / r.clicks) * 1000) / 10}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.approved}</td>
                  <td className="px-3 py-2 font-medium text-green-700">{formatRub(r.earned)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatRub(r.hold)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Последние {recent.length} {plural(recent.length, "переход", "перехода", "переходов")}
      </h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Время</th>
              <th className="px-3 py-2">Оператор · тариф</th>
              <th className="px-3 py-2">Откуда</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                  {c.createdAt.toLocaleString("ru-RU")}
                </td>
                <td className="px-3 py-2">
                  {c.provider.name}
                  {c.plan && <span className="text-slate-500"> · {c.plan.name}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{c.page ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.status ? STATUS_LABEL[c.status] : "—"}
                  {c.statusRaw && c.status && (
                    <span className="text-xs text-slate-400"> ({c.statusRaw})</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {c.payoutRub != null ? formatRub(c.payoutRub) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
