import { prisma } from "@/lib/db";
import { formatRub, plural } from "@/lib/format";
import { AdminNav } from "@/components/AdminNav";
import { LeadStatusControl } from "@/components/LeadStatusControl";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  NEW: { label: "Новые", cls: "text-slate-700" },
  CALLED: { label: "В работе", cls: "text-amber-700" },
  CONFIRMED: { label: "Подключено", cls: "text-green-700" },
  REJECTED: { label: "Отказы", cls: "text-red-600" },
};

const NETWORK_LABEL = {
  PENDING: "в обработке",
  HOLD: "холд",
  APPROVED: "одобрено",
  REJECTED: "отклонено",
} as const;

// Воронка заявок. CONFIRMED — это деньги: сумма из постбэка сети, а если её нет —
// ставка провайдера.
export default async function LeadsPage() {
  const [leads, grouped, confirmed] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { plan: { include: { provider: true } } },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.findMany({
      where: { status: "CONFIRMED" },
      include: { plan: { include: { provider: true } } },
    }),
  ]);

  const counts: Record<string, number> = { NEW: 0, CALLED: 0, CONFIRMED: 0, REJECTED: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const revenue = confirmed.reduce(
    (sum, l) => sum + (l.payoutRub ?? l.plan?.provider.payoutRub ?? 0),
    0,
  );
  const fromNetwork = confirmed.filter((l) => l.networkStatus === "APPROVED").length;
  // Конверсия заявка → подключение (аппрув) — ключевая метрика юнит-экономики.
  const closable = counts.CONFIRMED + counts.REJECTED;
  const approval = closable > 0 ? Math.round((counts.CONFIRMED / closable) * 100) : null;

  return (
    <div>
      <AdminNav current="/admin/leads" className="mb-1" />
      <h1 className="text-2xl font-bold text-slate-900">Заявки</h1>
      <p className="mt-1 text-sm text-slate-500">
        Воронка обработки. За подтверждённые подключения платит провайдер.
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <a
          href="/api/admin/leads/export?status=CONFIRMED"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-brand hover:border-brand"
        >
          Экспорт подтверждённых (CSV)
        </a>
        <a
          href="/api/admin/leads/export?status=ALL"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:border-slate-400"
        >
          Все (CSV)
        </a>
      </div>

      {/* Сводка воронки */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["NEW", "CALLED", "CONFIRMED", "REJECTED"] as const).map((s) => (
          <div key={s} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className={`text-2xl font-bold ${STATUS_META[s].cls}`}>{counts[s]}</div>
            <div className="text-xs text-slate-500">{STATUS_META[s].label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Metric label="Всего заявок" value={String(total)} />
        <Metric
          label="Аппрув (подкл. / закрытые)"
          value={approval === null ? "—" : `${approval}%`}
        />
        <Metric label="Выручка (подтверждённые)" value={formatRub(revenue)} highlight />
        <Metric
          label="Подтверждено сетью"
          value={confirmed.length > 0 ? `${fromNetwork} из ${confirmed.length}` : "—"}
        />
      </div>

      <p className="mt-3 max-w-3xl text-xs text-slate-500">
        Статусы можно получать от CPA-сети автоматически: передавая заявку в сеть, укажите её
        номер (серый под датой, колонка <code>id</code> в CSV) как метку <code>subid</code>.
        Постбэк — тот же адрес, что в разделе «Переходы»: «одобрено» ставит «Подключён» и сумму,
        «отклонено» — «Отказ».
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Последние {leads.length} {plural(leads.length, "заявка", "заявки", "заявок")}
      </h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Дата</th>
              <th className="px-3 py-2">Имя</th>
              <th className="px-3 py-2">Телефон</th>
              <th className="px-3 py-2">Адрес</th>
              <th className="px-3 py-2">Тариф</th>
              <th className="px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Заявок пока нет
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {l.createdAt.toLocaleString("ru-RU")}
                    <div className="select-all font-mono text-[11px] text-slate-400">{l.id}</div>
                  </td>
                  <td className="px-3 py-2">
                    {l.name}
                    {l.company && <div className="text-xs text-slate-500">{l.company}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{l.phone}</td>
                  <td className="px-3 py-2 text-slate-600">{l.addressText}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {l.plan ? `${l.plan.provider.name} — ${l.plan.name}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <LeadStatusControl id={l.id} status={l.status} />
                    {l.networkStatus && (
                      <div className="mt-1 text-xs text-slate-500">
                        Сеть{l.network ? ` ${l.network}` : ""}: {NETWORK_LABEL[l.networkStatus]}
                        {l.payoutRub != null && ` · ${formatRub(l.payoutRub)}`}
                        {l.networkAt && ` · ${l.networkAt.toLocaleDateString("ru-RU")}`}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-lg font-bold ${highlight ? "text-green-700" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
