import { JsonLd } from "./JsonLd";

// Блоки главной: шаги, преимущества, частые вопросы. Общие для главной с поиском по
// адресу и главной мобильной связи (app/page.tsx).

export type FaqItem = { q: string; a: string };

export function Step({ n, title, text }: { n: string; title: string; text: string }) {
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

export function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{text}</div>
    </div>
  );
}

/** Частые вопросы и их разметка FAQPage для поисковиков. */
export function FaqSection({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="mt-12">
      <JsonLd data={jsonLd} />
      <h2 className="text-xl font-bold text-slate-900">Частые вопросы</h2>
      <div className="mt-4 space-y-3">
        {items.map((f) => (
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
  );
}
