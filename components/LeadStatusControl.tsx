"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const STATUSES = [
  { value: "NEW", label: "Новая", active: "bg-slate-200 text-slate-800" },
  { value: "CALLED", label: "В работе", active: "bg-amber-100 text-amber-800" },
  { value: "CONFIRMED", label: "Подключён", active: "bg-green-100 text-green-800" },
  { value: "REJECTED", label: "Отказ", active: "bg-red-100 text-red-700" },
] as const;

export function LeadStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function change(next: string) {
    if (next === current || pending) return;
    const prev = current;
    setCurrent(next);
    setError(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error();
        router.refresh(); // пересчитать воронку/выручку на странице
      } catch {
        setCurrent(prev);
        setError(true);
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => change(s.value)}
            disabled={pending}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              current === s.value
                ? s.active
                : "bg-white text-slate-400 ring-1 ring-inset ring-slate-200 hover:text-slate-600"
            } ${pending ? "opacity-60" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <div className="mt-1 text-xs text-red-600">не сохранилось, попробуйте ещё раз</div>}
    </div>
  );
}
