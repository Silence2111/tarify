import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime, formatRub, formatShortDate, plural } from "@/lib/format";
import { AdminNav } from "@/components/AdminNav";
import { LeadDeliverButton } from "@/components/LeadDeliverButton";
import { LeadNote } from "@/components/LeadNote";
import { LeadStatusControl } from "@/components/LeadStatusControl";
import { deliveryEnabled, deliveryHost, normalizePhone } from "@/lib/lead-delivery";
import { LEAD_STATUSES, type LeadStatusValue } from "@/lib/lead-update";

export const dynamic = "force-dynamic";

const STATUS_META: Record<LeadStatusValue, { label: string; cls: string }> = {
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

// Ссылка для звонка: «8 (900) 123-45-67» → tel:+79001234567.
function telHref(phone: string): string {
  const d = normalizePhone(phone);
  return `tel:${d.length === 11 && d.startsWith("7") ? `+${d}` : d}`;
}

// Заявки для обзвона — карточками, чтобы разбирать их и с телефона: номер нажимается,
// статус — крупными кнопками, к заявке можно оставить заметку. Счётчики воронки — они же
// фильтр по статусу. CONFIRMED — это деньги: сумма из постбэка сети, а если её нет —
// ставка провайдера.
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = LEAD_STATUSES.find((s) => s === status) ?? null;

  const [leads, grouped, confirmed] = await Promise.all([
    prisma.lead.findMany({
      where: filter ? { status: filter } : undefined,
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

  const counts: Record<LeadStatusValue, number> = { NEW: 0, CALLED: 0, CONFIRMED: 0, REJECTED: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const revenue = confirmed.reduce(
    (sum, l) => sum + (l.payoutRub ?? l.plan?.provider.payoutRub ?? 0),
    0,
  );
  const fromNetwork = confirmed.filter((l) => l.networkStatus === "APPROVED").length;
  const delivery = deliveryEnabled();
  const host = deliveryHost();
  // Конверсия заявка → подключение (аппрув) — ключевая метрика юнит-экономики.
  const closable = counts.CONFIRMED + counts.REJECTED;
  const approval = closable > 0 ? Math.round((counts.CONFIRMED / closable) * 100) : null;
  const shown = filter ? counts[filter] : total;

  return (
    <div>
      <AdminNav current="/admin/leads" />
      <h1 className="text-2xl font-bold text-slate-900">Заявки</h1>
      <p className="mt-1 text-sm text-slate-500">
        Позвоните клиенту и отметьте статус. За подтверждённые подключения платит провайдер.
      </p>

      {/* Воронка: нажатие — показать только этот статус, повторное — все заявки */}
      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={filter === s ? "/admin/leads" : `/admin/leads?status=${s}`}
            aria-current={filter === s ? "true" : undefined}
            className={`rounded-xl border p-2 sm:p-3 ${
              filter === s
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <div className={`text-xl font-bold sm:text-2xl ${filter === s ? "" : STATUS_META[s].cls}`}>
              {counts[s]}
            </div>
            <div
              className={`truncate text-[11px] sm:text-xs ${filter === s ? "text-white/80" : "text-slate-500"}`}
            >
              {STATUS_META[s].label}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Metric label="Выручка" value={formatRub(revenue)} highlight />
        <Metric label="Аппрув" value={approval === null ? "—" : `${approval}%`} />
        <Metric
          label="Одобрено сетью"
          value={confirmed.length > 0 ? `${fromNetwork} из ${confirmed.length}` : "—"}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {filter ? `${STATUS_META[filter].label}: ` : "Все заявки: "}
          {shown}
          {shown > leads.length && `, показаны последние ${leads.length}`}
        </h2>
        <span className="flex gap-4 text-sm">
          {filter && (
            <Link href="/admin/leads" className="text-brand hover:underline">
              Показать все
            </Link>
          )}
          <a
            href={`/api/admin/leads/export?status=${filter ?? "ALL"}`}
            className="text-brand hover:underline"
          >
            Скачать CSV
          </a>
        </span>
      </div>

      {leads.length === 0 ? (
        <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
          {filter ? "Заявок с таким статусом нет" : "Заявок пока нет"}
        </div>
      ) : (
        <ul className="mt-2 grid gap-3 lg:grid-cols-2">
          {leads.map((l) => (
            <li key={l.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{l.name}</div>
                  {l.company && <div className="text-sm text-slate-500">{l.company}</div>}
                </div>
                <time
                  dateTime={l.createdAt.toISOString()}
                  className="shrink-0 text-xs text-slate-400"
                >
                  {formatDateTime(l.createdAt)}
                </time>
              </div>

              <a
                href={telHref(l.phone)}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-1.5 text-base font-semibold text-brand hover:bg-brand/15"
              >
                <PhoneIcon />
                {l.phone}
              </a>

              <div className="mt-2 space-y-0.5 text-sm">
                <div className="text-slate-700">{l.addressText}</div>
                {l.plan && (
                  <div className="text-slate-500">
                    {l.plan.provider.name} — {l.plan.name}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <LeadStatusControl id={l.id} status={l.status} />
              </div>

              {l.networkStatus && (
                <div className="mt-2 text-xs text-slate-500">
                  Сеть{l.network ? ` ${l.network}` : ""}: {NETWORK_LABEL[l.networkStatus]}
                  {l.payoutRub != null && ` · ${formatRub(l.payoutRub)}`}
                  {l.networkAt && ` · ${formatShortDate(l.networkAt)}`}
                </div>
              )}
              {l.deliveredAt ? (
                <div className="mt-2 text-xs text-slate-400">
                  Передана в сеть {formatDateTime(l.deliveredAt)}
                </div>
              ) : (
                delivery && (
                  <div className="mt-2 space-y-1 text-xs">
                    {l.deliveryError && (
                      <div className="break-words text-red-600">Не передана: {l.deliveryError}</div>
                    )}
                    <LeadDeliverButton
                      id={l.id}
                      label={l.deliveryError ? "Отправить ещё раз" : "Отправить в сеть"}
                    />
                  </div>
                )
              )}

              <LeadNote id={l.id} comment={l.comment} />

              <div className="mt-2 select-all font-mono text-[11px] text-slate-400">№ {l.id}</div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 max-w-3xl text-xs text-slate-500">
        {delivery
          ? `Новые заявки сразу уходят в сеть (${host ?? "адрес приёма"}).`
          : "Сами в сеть заявки пока не уходят: скачайте CSV и загрузите в кабинете сети. Как включить автоотправку — в «Запуске»."}{" "}
        Номер заявки (внизу карточки, колонка id в CSV) — это метка subid: по ней сеть сама
        вернёт статус. «Одобрено» отметит заявку «Подключён», «отклонено» — «Отказ».
      </p>
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
      className={`rounded-xl border p-2.5 sm:p-3 ${
        highlight ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-base font-bold sm:text-lg ${highlight ? "text-green-700" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5.5A2.5 2.5 0 0 1 5.5 3h1.2a1 1 0 0 1 .97.76l.9 3.6a1 1 0 0 1-.29.98l-1.6 1.5a13 13 0 0 0 7.48 7.48l1.5-1.6a1 1 0 0 1 .98-.29l3.6.9a1 1 0 0 1 .76.97v1.2a2.5 2.5 0 0 1-2.5 2.5h-1C9.6 21 3 14.4 3 6.5v-1Z"
      />
    </svg>
  );
}
