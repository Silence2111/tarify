import type { Metadata } from "next";
import Link from "next/link";
import { PriceChangeList } from "@/components/PriceChangeList";
import { plural } from "@/lib/format";
import {
  FEED_DAYS,
  FEED_MIN_INDEXABLE,
  getPriceChangeStats,
  getPriceChanges,
} from "@/lib/price-history";
import { HOME_PLAN_TYPES, type PlanType } from "@/lib/types";

export const dynamic = "force-dynamic";

// Лента изменений цен: подорожания, снижения, новые и снятые тарифы. Операторы
// повышают цены каждый год, и «МТС повысил цены» ищут те, кто готов сменить тариф.
const SECTIONS: Record<string, { label: string; types: readonly PlanType[] }> = {
  mobile: { label: "Мобильная связь", types: ["MOBILE"] },
  home: { label: "Домашний интернет", types: HOME_PLAN_TYPES },
  business: { label: "Для бизнеса", types: ["BUSINESS_ACCOUNT"] },
};

type Props = { searchParams: Promise<{ type?: string }> };

const SHOWN = 300;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { type } = await searchParams;
  const section = type ? SECTIONS[type] : undefined;
  const items = await getPriceChanges({ types: section?.types, take: FEED_MIN_INDEXABLE });
  return {
    title: "Изменения цен на тарифы связи и интернета",
    description:
      "Какие тарифы операторов и провайдеров подорожали, подешевели, появились и сняты с продажи — с датами и суммами.",
    alternates: { canonical: "/izmeneniya-cen" },
    // Пустая лента — не страница для поиска.
    ...(items.length < FEED_MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function PriceChangesPage({ searchParams }: Props) {
  const { type } = await searchParams;
  const section = type ? SECTIONS[type] : undefined;
  const [items, stats] = await Promise.all([
    getPriceChanges({ types: section?.types, take: SHOWN }),
    getPriceChangeStats({ types: section?.types }),
  ]);
  const total = stats.up + stats.down + stats.added + stats.removed;

  const summary = [
    stats.up > 0 &&
      `${plural(stats.up, "подорожал", "подорожали", "подорожали")} ${stats.up} ${plural(stats.up, "тариф", "тарифа", "тарифов")}${
        stats.avgUpPercent != null ? ` — в среднем на ${stats.avgUpPercent}%` : ""
      }`,
    stats.down > 0 && `${plural(stats.down, "подешевел", "подешевели", "подешевели")} ${stats.down}`,
    stats.added > 0 &&
      `${plural(stats.added, "появился", "появились", "появилось")} ${stats.added} ${plural(stats.added, "новый", "новых", "новых")}`,
    stats.removed > 0 &&
      `${plural(stats.removed, "снят", "сняты", "снято")} с продажи ${stats.removed}`,
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        / Изменения цен
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Изменения цен на тарифы</h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        Каждое обновление прайсов операторов и провайдеров мы сравниваем с прошлым: здесь
        подорожания, снижения цен, новые и снятые с продажи тарифы за последние {FEED_DAYS} дней.
      </p>
      {summary.length > 0 && (
        <p className="mt-2 text-sm text-slate-700">
          За {FEED_DAYS} дней {summary.join(", ")}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Chip href="/izmeneniya-cen" active={!section}>
          Все
        </Chip>
        {Object.entries(SECTIONS).map(([key, s]) => (
          <Chip key={key} href={`/izmeneniya-cen?type=${key}`} active={section === s}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="mt-6">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            Изменений пока нет — они появятся, когда обновятся прайсы.
          </div>
        ) : (
          <PriceChangeList items={items} groupByDay />
        )}
        {total > items.length && (
          <p className="mt-3 text-sm text-slate-500">
            Показаны последние {items.length} из {total} изменений.
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Изменения фиксируются при загрузке прайсов с сайтов операторов и провайдеров. Первая
        загрузка прайса оператора в регионе в ленту не попадает. Точные условия — на сайте
        оператора.
      </p>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}
