"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Кнопка «Убрать демо-данные» в «Запуске»: с подтверждением, итог — числами. Компонент
// остаётся на странице и после очистки (available=false): иначе обновление страницы
// убрало бы его вместе со строкой итога.
export function DemoCleanupButton({ summary, available }: { summary: string; available: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!confirm(`Убрать демо-данные?\n\n${summary}\n\nРеальные прайсы и покрытие не затрагиваются.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/demo", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Не получилось");
          return;
        }
        setResult(
          `Удалено: покрытие — ${data.coverage}, домов — ${data.buildings}, улиц — ${data.streets}, ` +
            `городов — ${data.cities}. Скрыто демо-тарифов — ${data.plansHidden}.`,
        );
        router.refresh();
      } catch {
        setError("Нет связи");
      }
    });
  }

  if (!available && !result && !error) return null;
  return (
    <div className="mt-2">
      {available && (
        <button
          onClick={run}
          disabled={pending}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:border-red-400 disabled:opacity-60"
        >
          {pending ? "Убираю…" : "Убрать демо-данные"}
        </button>
      )}
      {result && <p className="mt-1 text-xs text-green-700">{result}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
