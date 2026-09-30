import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

const SECTIONS = [
  { href: "/admin/leads", label: "Заявки" },
  { href: "/admin/coverage", label: "Покрытие" },
  { href: "/admin/plans", label: "Тарифы" },
  { href: "/admin/clicks", label: "Переходы" },
  { href: "/admin/launch", label: "Запуск" },
] as const;

// Разделы админки вкладками: на телефоне — сеткой 3×2 вместе с «Выйти», чтобы всё было
// видно без прокрутки; на широком экране — в одну строку.
export function AdminNav({
  current,
  className = "mb-4",
}: {
  current: (typeof SECTIONS)[number]["href"];
  className?: string;
}) {
  return (
    <nav className={`${className} grid grid-cols-3 gap-1.5 text-sm sm:flex sm:items-center`}>
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.href === current ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-center font-medium ${
            s.href === current
              ? "bg-brand text-white"
              : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:text-brand"
          }`}
        >
          {s.label}
        </Link>
      ))}
      <span className="flex items-center justify-center sm:ml-auto sm:pl-2">
        <LogoutButton />
      </span>
    </nav>
  );
}
