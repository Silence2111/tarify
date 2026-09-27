import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md py-10 text-center">
      <p className="text-sm font-medium text-ink-2">Ошибка 404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Такой страницы нет</h1>
      <p className="mt-2 text-ink-2">
        Возможно, в адресе опечатка или этого города пока нет в базе.
      </p>
      <Link href="/" className="btn mt-6">
        Проверить адрес на главной
      </Link>
    </div>
  );
}
