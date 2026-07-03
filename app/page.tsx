import Link from "next/link";
import { prisma } from "@/lib/db";
import { AddressSearch } from "@/components/AddressSearch";
import { plural } from "@/lib/format";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "Почему подбор бесплатный?",
    a: "Мы получаем вознаграждение от провайдера за подключённого абонента. Для вас цена тарифа — та же, что напрямую у провайдера, без наценки.",
  },
  {
    q: "Откуда вы знаете, какие провайдеры есть в моём доме?",
    a: "Мы ведём базу покрытия по адресам: какие операторы заводят интернет в конкретный дом. Точный список подтверждаем при звонке.",
  },
  {
    q: "Что будет после заявки?",
    a: "Перезвоним, уточним адрес и техническую возможность, согласуем тариф и дату подключения. Никаких обязательств — можно отказаться.",
  },
];

export default async function HomePage() {
  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
  const [providerCount, planCount, buildingCount] = await Promise.all([
    prisma.provider.count({ where: { isActive: true } }),
    prisma.plan.count({ where: { isActive: true } }),
    prisma.building.count(),
  ]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark px-6 py-12 text-white sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Какие провайдеры подключают интернет по вашему адресу?
        </h1>
        <p className="mt-3 max-w-xl text-base text-white/80">
          Введите адрес — покажем доступные тарифы и поможем подключить. Бесплатно и без наценки.
        </p>
        <div className="mt-6 rounded-xl bg-white p-4 text-slate-900 shadow-xl">
          <AddressSearch cities={cities} />
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70">
          <span>{providerCount} {plural(providerCount, "провайдер", "провайдера", "провайдеров")}</span>
          <span>{planCount} {plural(planCount, "тариф", "тарифа", "тарифов")}</span>
          <span>{buildingCount.toLocaleString("ru-RU")} {plural(buildingCount, "дом", "дома", "домов")} в базе</span>
        </div>
      </section>

      {/* Как это работает */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Как это работает</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Вводите адрес" text="Город, улица, дом — за пару секунд." />
          <Step n="2" title="Сравниваете тарифы" text="Только провайдеры, доступные в вашем доме. Фильтры по цене, скорости, ТВ." />
          <Step n="3" title="Оставляете заявку" text="Перезвоним и поможем подключить в удобную дату." />
        </div>
      </section>

      {/* Почему бесплатно */}
      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Feature title="Честная цена" text="Стоимость тарифа — как у провайдера напрямую. Мы не делаем наценку." />
        <Feature title="Только реальные варианты" text="Показываем провайдеров, которые физически заводят интернет в ваш дом." />
        <Feature title="Помощь с подключением" text="Сопроводим от заявки до монтажа. Можно отказаться на любом шаге." />
      </section>

      {/* Города */}
      {cities.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-slate-900">Города</h2>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <Link
                key={c.id}
                href={`/${c.slug}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-brand hover:border-brand"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Частые вопросы</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer list-none font-medium text-slate-800 marker:hidden">
                <span className="text-brand">＋ </span>
                {f.q}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {n}
      </div>
      <div className="mt-3 font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{text}</div>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{text}</div>
    </div>
  );
}
