import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-5xl font-bold text-brand">404</div>
      <h1 className="mt-3 text-xl font-semibold text-slate-800">Страница не найдена</h1>
      <p className="mt-2 text-sm text-slate-500">
        Возможно, адрес введён неверно или страницы больше нет.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        На главную
      </Link>
    </div>
  );
}
