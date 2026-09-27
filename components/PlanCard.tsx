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
  const promo = plan.priceFirst != null && plan.priceFirst < plan.priceMonthly;
  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.speedMbps != null && <Badge>{plan.speedMbps} Мбит/с</Badge>}
            {plan.hasTv && <Badge>ТВ{plan.tvChannels ? ` · ${plan.tvChannels} каналов` : ""}</Badge>}
            {plan.hasMobile && <Badge>Мобильная связь{plan.mobileGb ? ` · ${plan.mobileGb} ГБ` : ""}</Badge>}
          </div>
          {plan.description && <p className="mt-3 max-w-md text-ink-2">{plan.description}</p>}
          {plan.options.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-ink-2">
              {plan.options.map((o, i) => (
                <li key={i}>
                  {o.label}: <span className="text-ink">{o.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="sm:text-right">
          <div className="text-2xl font-semibold text-ink">
            {formatRub(plan.priceMonthly)} <span className="text-base font-normal text-ink-2">в месяц</span>
          </div>
          {promo && (
            <div className="badge mt-2 bg-ok-bg text-ok">{formatRub(plan.priceFirst!)} первый месяц</div>
          )}
        </div>
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <LeadForm
          planId={plan.id}
          planName={plan.name}
          providerName={providerName}
          addressText={addressText}
          buildingId={buildingId}
        />
      </div>
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge bg-tint text-ink-2">{children}</span>;
}
