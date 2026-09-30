import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

const SECTIONS = [
  { href: "/admin/leads", label: "Заявки" },
  { href: "/admin/coverage", label: "Покрытие" },
  { href: "/admin/plans", label: "Тарифы" },
] as const;

// Разделы админки: текущий — текстом, остальные — ссылками.
export function AdminNav({
  current,
  className = "mb-4",
}: {
  current: (typeof SECTIONS)[number]["href"];
  className?: string;
}) {
  return (
    <div className={`${className} flex items-center justify-between text-sm text-slate-500`}>
      <span>
        {SECTIONS.map((s, i) => (
          <span key={s.href}>
            {i > 0 && " / "}
            {s.href === current ? (
              s.label
            ) : (
              <Link href={s.href} className="hover:text-brand">
                {s.label}
              </Link>
            )}
          </span>
        ))}
      </span>
      <LogoutButton />
    </div>
  );
}
