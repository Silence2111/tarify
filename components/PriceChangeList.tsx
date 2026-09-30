import Link from "next/link";
import { formatDay, formatRub, formatShortDate } from "@/lib/format";
import { changePercent, type FeedItem } from "@/lib/price-history";

// Строки ленты изменений цен: на странице ленты — по дням, на странице оператора —
// последние несколько с датой в строке.
export function PriceChangeList({
  items,
  groupByDay = false,
}: {
  items: FeedItem[];
  groupByDay?: boolean;
}) {
  if (!groupByDay) {
    return (
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {items.map((i) => (
          <Row key={i.id} item={i} date />
        ))}
      </ul>
    );
  }

  const days = new Map<string, FeedItem[]>();
  for (const i of items) {
    const day = formatDay(i.createdAt);
    const list = days.get(day);
    if (list) list.push(i);
    else days.set(day, [i]);
  }
  return (
    <div className="space-y-5">
      {[...days].map(([day, list]) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{day}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {list.map((i) => (
              <Row key={i.id} item={i} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const KIND = {
  UP: { label: "Подорожал", cls: "bg-amber-100 text-amber-800" },
  DOWN: { label: "Подешевел", cls: "bg-green-100 text-green-800" },
  NEW: { label: "Новый", cls: "bg-sky-100 text-sky-800" },
  REMOVED: { label: "Снят", cls: "bg-slate-100 text-slate-600" },
} as const;

function Row({ item: i, date = false }: { item: FeedItem; date?: boolean }) {
  const kind = KIND[i.kind];
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${kind.cls}`}>{kind.label}</span>
      <span className="min-w-0 flex-1 text-slate-800">
        {i.planType === "MOBILE" ? (
          <Link href={`/mobile/${i.providerSlug}`} className="text-brand hover:underline">
            {i.providerName}
          </Link>
        ) : (
          i.providerName
        )}{" "}
        «{i.planName}»
        {i.region && <span className="text-slate-400"> · {i.region}</span>}
        {date && <span className="text-slate-400"> · {formatShortDate(i.createdAt)}</span>}
      </span>
      <span className="whitespace-nowrap font-medium text-slate-700">
        <Price item={i} />
      </span>
    </li>
  );
}

function Price({ item: i }: { item: FeedItem }) {
  if (i.kind === "NEW") return <>{i.newPrice != null ? formatRub(i.newPrice) : ""}</>;
  if (i.kind === "REMOVED") {
    return <span className="text-slate-400">был {i.oldPrice != null ? formatRub(i.oldPrice) : "—"}</span>;
  }
  if (i.oldPrice == null || i.newPrice == null) return null;
  const pct = changePercent(i.oldPrice, i.newPrice); // с 0 ₽ процента нет
  return (
    <>
      {formatRub(i.oldPrice)} → {formatRub(i.newPrice)}
      {pct && (
        <span className={i.kind === "UP" ? "text-amber-700" : "text-green-700"}> ({pct})</span>
      )}
    </>
  );
}
