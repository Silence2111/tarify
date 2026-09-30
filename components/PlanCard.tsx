import { amountText } from "@/lib/catalog-filter";
import { formatRub } from "@/lib/format";
import type { PlanView } from "@/lib/types";
import { LeadForm } from "./LeadForm";

export function PlanCard({
  plan,
  providerName,
  addressText,
  buildingId,
  eyebrow,
  actionLabel = "Оформить на сайте оператора",
}: {
  plan: PlanView;
  providerName: string;
  addressText: string;
  buildingId?: string;
  eyebrow?: string; // имя оператора над названием — в каталогах, где тарифы идут общим списком
  actionLabel?: string;
}) {
  const mobile = plan.type === "MOBILE";
  const gb = amountText(plan.mobileGb, "ГБ");
  const minutes = amountText(plan.minutes, "мин");
  const sms = amountText(plan.sms, "SMS");
  // Партнёрская ссылка ведёт на сайт оператора; без неё — заявка с обзвоном.
  const partnerUrl = plan.url && /^https?:\/\//.test(plan.url) ? plan.url : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-xs font-medium text-slate-500">{eyebrow}</div>}
          <div className="font-semibold text-slate-800">{plan.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {plan.speedMbps != null && <Badge>{plan.speedMbps} Мбит/с</Badge>}
            {plan.hasTv && <Badge>ТВ{plan.tvChannels ? ` · ${plan.tvChannels} каналов` : ""}</Badge>}
            {mobile
              ? gb && <Badge>{gb === "безлимит" ? "Безлимитный интернет" : gb}</Badge>
              : plan.hasMobile && <Badge>Моб.{gb ? ` · ${gb}` : ""}</Badge>}
            {minutes && <Badge>{minutes === "безлимит" ? "Безлимит минут" : minutes}</Badge>}
            {sms && <Badge>{sms === "безлимит" ? "Безлимит SMS" : sms}</Badge>}
            {plan.esim && <Badge>eSIM</Badge>}
          </div>
          {plan.description && (
            <p className="mt-2 max-w-md text-sm text-slate-500">{plan.description}</p>
          )}
          {plan.options.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {plan.options.map((o, i) => (
                <li key={i}>
                  {o.label}: <span className="text-slate-700">{o.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-slate-900">{formatRub(plan.priceMonthly)}</div>
          <div className="text-xs text-slate-400">в месяц</div>
          {plan.priceFirst != null && plan.priceFirst < plan.priceMonthly && (
            <div className="mt-1 text-xs font-medium text-green-600">
              {formatRub(plan.priceFirst)} за первый месяц
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {partnerUrl ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={partnerUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              {actionLabel}
            </a>
            {plan.erid && (
              <span className="text-xs text-slate-400">
                Реклама · {providerName} · erid: {plan.erid}
              </span>
            )}
          </div>
        ) : (
          <LeadForm
            planId={plan.id}
            planName={plan.name}
            providerName={providerName}
            addressText={addressText}
            buildingId={buildingId}
          />
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{children}</span>
  );
}
