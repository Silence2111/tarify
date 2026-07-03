import { formatRub } from "@/lib/format";
import type { PlanView } from "@/lib/types";
import { LeadForm } from "./LeadForm";

export function PlanCard({
  plan,
  providerName,
  addressText,
  buildingId,
}: {
  plan: PlanView;
  providerName: string;
  addressText: string;
  buildingId?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-800">{plan.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {plan.speedMbps != null && <Badge>{plan.speedMbps} Мбит/с</Badge>}
            {plan.hasTv && <Badge>ТВ{plan.tvChannels ? ` · ${plan.tvChannels} каналов` : ""}</Badge>}
            {plan.hasMobile && <Badge>Моб.{plan.mobileGb ? ` · ${plan.mobileGb} ГБ` : ""}</Badge>}
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
        <LeadForm
          planId={plan.id}
          planName={plan.name}
          providerName={providerName}
          addressText={addressText}
          buildingId={buildingId}
        />
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{children}</span>
  );
}
