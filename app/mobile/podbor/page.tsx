import type { Metadata } from "next";
import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { getCatalogPlans, getMobileRegionContext } from "@/lib/catalog";
import { amountText, pickRegion } from "@/lib/catalog-filter";
import { formatRub, plural } from "@/lib/format";
import {
  amountParam,
  GB_CHOICES,
  hasUsageQuery,
  matchPlans,
  MINUTE_CHOICES,
  param,
  parseUsage,
  PRESETS,
  savings,
  usageText,
  type Params,
} from "@/lib/usage";
import { catalogPath } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Params> };

const SHOWN = 10;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: "Подобрать тариф мобильной связи под свой расход",
    description:
      "Укажите, сколько гигабайт и минут тратите и сколько платите сейчас, — покажем подходящие тарифы операторов вашего региона по цене и сколько можно сэкономить.",
    alternates: { canonical: "/mobile/podbor" },
    // Результаты под конкретный расход — не отдельные страницы для поиска.
    ...(hasUsageQuery(sp) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function PodborPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { regions, defaultRegion } = await getMobileRegionContext();
  const region = pickRegion(param(sp, "region") || undefined, regions);
  const plans = await getCatalogPlans("MOBILE", { region });

  const asked = hasUsageQuery(sp);
  const usage = parseUsage(sp, plans);
  const current = plans.find((p) => p.id === usage.current) ?? null;
  const matches = matchPlans(plans, usage);
  const best = matches[0] ?? null;
  const bestSaving = best ? savings(best.priceMonthly, usage.pay) : null;
  const catalogHref = catalogPath("/mobile", region, defaultRegion);
  const regionIn = region ? ` в регионе ${region}` : "";

  // Пакет своего тарифа может не совпасть с вариантами списка — добавляем его,
  // иначе форма показала бы не то, по чему подобраны тарифы.
  const gbChoices = withValue(GB_CHOICES, usage.gb, amountText(usage.gb, "ГБ"));
  const minuteChoices = withValue(MINUTE_CHOICES, usage.minutes, amountText(usage.minutes, "минут"));
  const operators = [...new Set(plans.map((p) => p.providerName))];

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        /{" "}
        <Link href={catalogHref} className="hover:text-brand">
          Мобильная связь
        </Link>{" "}
        / Подбор под расход
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        Подобрать тариф под свой расход{region ? ` — ${region}` : ""}
      </h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        Укажите, сколько интернета и звонков вам нужно в месяц и сколько платите сейчас, — покажем
        подходящие тарифы всех операторов по цене и сколько можно сэкономить.
      </p>

      <form
        action="/mobile/podbor"
        className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {regions.length > 0 && (
          <Field label="Регион">
            <select name="region" defaultValue={region ?? ""} className={INPUT}>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Интернет в месяц">
          <select name="gb" defaultValue={amountParam(usage.gb)} className={INPUT}>
            {gbChoices.map((c) => (
              <option key={c.value} value={amountParam(c.value)}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Звонки в месяц">
          <select name="min" defaultValue={amountParam(usage.minutes)} className={INPUT}>
            {minuteChoices.map((c) => (
              <option key={c.value} value={amountParam(c.value)}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Сейчас плачу, ₽ в месяц">
          <input
            name="pay"
            type="number"
            inputMode="numeric"
            min={1}
            max={99999}
            defaultValue={usage.pay ?? ""}
            placeholder="например, 700"
            className={INPUT}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="esim" value="1" defaultChecked={usage.esim} />
            Нужна eSIM
          </label>
          {current && <input type="hidden" name="my" value={current.id} />}
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Подобрать
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Не знаете свой расход?</span>
        {PRESETS.map((p) => (
          <Link
            key={p.label}
            href={`/mobile/podbor?${new URLSearchParams({
              ...(region ? { region } : {}),
              gb: amountParam(p.gb),
              min: amountParam(p.minutes),
            })}`}
            className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
          >
            {p.label}
          </Link>
        ))}
      </div>

      {plans.length > 0 && (
        <form
          action="/mobile/podbor"
          className="mt-3 flex flex-wrap items-center gap-2 text-sm"
        >
          {region && <input type="hidden" name="region" value={region} />}
          <label htmlFor="my" className="text-slate-500">
            Или выберите свой тариф — найдём такой же пакет дешевле:
          </label>
          <select id="my" name="my" defaultValue={current?.id ?? ""} className={`${INPUT} w-auto`}>
            <option value="" disabled>
              Мой тариф…
            </option>
            {operators.map((op) => (
              <optgroup key={op} label={op}>
                {plans
                  .filter((p) => p.providerName === op)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatRub(p.priceMonthly)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:border-brand hover:text-brand"
          >
            Сравнить
          </button>
        </form>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-800">
          {asked
            ? `Под ${usageText(usage)}${usage.esim ? " с eSIM" : ""} ${plural(matches.length, "подходит", "подходят", "подходят")} ${matches.length} ${plural(matches.length, "тариф", "тарифа", "тарифов")}${matches.length ? ` — от ${formatRub(matches[0].priceMonthly)}` : ""}`
            : `Например, под ${usageText(usage)} — ${matches.length} ${plural(matches.length, "тариф", "тарифа", "тарифов")}`}
        </h2>

        {current && (
          <p className="mt-1 text-sm text-slate-600">
            Ваш тариф — {current.providerName} «{current.name}» за {formatRub(current.priceMonthly)}{" "}
            в месяц. Ниже — тарифы с таким же или бо́льшим пакетом.
          </p>
        )}

        {usage.pay != null && matches.length > 0 && (
          <div
            className={`mt-3 rounded-xl border p-4 text-sm ${
              bestSaving ? "border-green-200 bg-green-50 text-green-900" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {bestSaving && best ? (
              <>
                Вы платите {formatRub(usage.pay)}. Самый дешёвый подходящий тариф — {best.providerName} «
                {best.name}» за {formatRub(best.priceMonthly)}:{" "}
                <strong>
                  экономия {formatRub(bestSaving.month)} в месяц, {formatRub(bestSaving.year)} в год
                </strong>
                .
              </>
            ) : (
              <>
                Вы платите {formatRub(usage.pay)} — дешевле под такой расход{regionIn} тарифов нет.
                Похоже, ваш тариф уже выгодный.
              </>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              {plans.length === 0
                ? "Тарифов пока нет. Они появятся, когда в админке загрузят прайс операторов."
                : `Под ${usageText(usage)}${usage.esim ? " с eSIM" : ""}${regionIn} тарифов нет. Попробуйте пакет поменьше или посмотрите все тарифы.`}
            </div>
          ) : (
            matches.slice(0, SHOWN).map((p) => {
              const s = savings(p.priceMonthly, usage.pay);
              return (
                <PlanCard
                  key={p.id}
                  plan={p}
                  providerName={p.providerName}
                  addressText={p.region ?? "вся Россия"}
                  eyebrow={p.providerName}
                  priceNote={s ? `дешевле на ${formatRub(s.month)}` : undefined}
                />
              );
            })
          )}
        </div>

        {matches.length > SHOWN && (
          <p className="mt-3 text-sm text-slate-500">
            Показаны {SHOWN} самых дешёвых из {matches.length}.{" "}
            <Link href={catalogHref} className="text-brand hover:underline">
              Все тарифы региона →
            </Link>
          </p>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-400">
        Подбор — по пакету интернета и минут, без учёта опций вроде безлимитных мессенджеров. Цены —
        по данным операторов на момент загрузки, точные условия — на сайте оператора. Мы получаем
        вознаграждение от операторов за оформление по ссылкам; для вас цена та же.
      </p>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/** Варианты списка плюс текущее значение, если его там нет (по порядку величины). */
function withValue(
  choices: { value: number; label: string }[],
  value: number,
  label: string | null,
): { value: number; label: string }[] {
  if (choices.some((c) => c.value === value) || !label) return choices;
  const rank = (v: number) => (v < 0 ? Number.POSITIVE_INFINITY : v);
  return [...choices, { value, label }].sort((a, b) => rank(a.value) - rank(b.value));
}
