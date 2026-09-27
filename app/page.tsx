import { prisma } from "@/lib/db";
import { AddressSearch } from "@/components/AddressSearch";
import { plural } from "@/lib/format";
import { LeadForm } from "@/components/LeadForm";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "Почему подбор бесплатный?",
    a: "Мы получаем вознаграждение от провайдера за подключённого абонента. Для вас цена тарифа — та же, что напрямую у провайдера, без наценки.",
  },
  {
    q: "Откуда вы знаете, какие провайдеры есть в моём доме?",
    a: "Из базы покрытия: какие операторы заводят интернет в конкретный дом. Сейчас в ней только демо-данные по одному городу. Настоящее покрытие приходит от провайдеров и партнёрских сетей, по мере договоров.",
  },
  {
    q: "Почему только Казань?",
    a: "Это демо. Лучше честно закрыть один город целиком, чем показывать всю страну по трём домам на улицу. Нет вашего адреса — оставьте телефон ниже, подберём вручную.",
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

  // Несколько настоящих адресов из базы — чтобы показ не упирался в угадывание улиц.
  const sample = await prisma.building.findMany({
    take: 3,
    orderBy: [{ street: { name: "asc" } }, { house: "asc" }],
    where: { coverage: { some: {} } },
    select: { house: true, street: { select: { name: true } } },
  });
  const examples = sample.map((b) => ({ street: b.street.name, house: b.house }));
  const cityNames = cities.map((c) => c.name).join(", ");

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="rounded-panel bg-panel p-6 shadow-card sm:p-10">
        <span className="badge bg-brand-soft text-brand-text">Бесплатно для вас · без наценки</span>
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          Какой интернет можно провести в ваш дом
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink-2">
          Введите адрес — покажем провайдеров, которые заводят кабель именно в этот дом,
          и их тарифы. Подключение оформим сами.
        </p>
        <div className="mt-6">
          <AddressSearch cities={cities} examples={examples} />
        </div>
        <p className="mt-6 border-t border-line pt-4 text-sm text-ink-2">
          Сейчас в базе: {cityNames || "нет городов"} — {buildingCount.toLocaleString("ru-RU")}{" "}
          {plural(buildingCount, "дом", "дома", "домов")}, {providerCount}{" "}
          {plural(providerCount, "провайдер", "провайдера", "провайдеров")}, {planCount}{" "}
          {plural(planCount, "тариф", "тарифа", "тарифов")}. Это демо-данные.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-ink">Как это работает</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Вводите адрес" text="Город, улица, дом. Если точного дома нет, покажем улицу и предупредим." />
          <Step n="2" title="Сравниваете тарифы" text="Только провайдеры, доступные в вашем доме. Фильтры по цене, скорости и ТВ." />
          <Step n="3" title="Оставляете телефон" text="Перезваниваем, проверяем техническую возможность и согласуем дату монтажа." />
        </div>
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-[1fr_1.2fr] sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Нет вашего адреса?</h2>
          <p className="mt-2 text-ink-2">
            Оставьте адрес и телефон — проверим, кто заводит интернет в ваш дом,
            и перезвоним с вариантами.
          </p>
        </div>
        <div className="card">
          <LeadForm addressText="Ручной подбор" startOpen askAddress submitText="Подобрать вручную" />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-ink">Частые вопросы</h2>
        <div className="mt-4 divide-y divide-line rounded-card bg-panel px-5 shadow-card sm:px-6">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-ink marker:hidden">
                {f.q}
                <span aria-hidden className="text-xl text-ink-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="card">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-text">
        {n}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-ink-2">{text}</p>
    </div>
  );
}
