import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Контакты",
  robots: { index: false },
};

function Fill({ children }: { children: string }) {
  return <span className="rounded bg-warn-bg px-1.5 text-warn">заполнить: {children}</span>;
}

// Реквизитов у владельца пока нет: страница есть, поля помечены, ничего не выдумано.
export default function ContactsPage() {
  return (
    <article className="card max-w-2xl sm:p-10">
      <h1 className="text-3xl font-semibold text-ink">Контакты</h1>
      <dl className="mt-6 grid gap-4 text-ink-2">
        <div><dt className="font-medium text-ink">Телефон</dt><dd><Fill>номер</Fill></dd></div>
        <div><dt className="font-medium text-ink">Почта</dt><dd><Fill>почта</Fill></dd></div>
        <div><dt className="font-medium text-ink">Реквизиты</dt><dd><Fill>ФИО или название, ИНН, ОГРН/ОГРНИП</Fill></dd></div>
      </dl>
      <p className="mt-6 text-ink-2">
        Подбор бесплатный для вас: вознаграждение платит провайдер за подключённого абонента.
      </p>
    </article>
  );
}
