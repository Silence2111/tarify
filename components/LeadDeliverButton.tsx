"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Повторная передача заявки в CPA-сеть или CRM из админки.
export function LeadDeliverButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/leads/${id}/deliver`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) setError(data.error ?? "не удалось");
        router.refresh();
      } catch {
        setError("нет связи");
      }
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        onClick={send}
        disabled={pending}
        className="rounded px-2 py-0.5 text-xs font-medium text-brand ring-1 ring-inset ring-slate-200 hover:ring-brand disabled:opacity-60"
      >
        {pending ? "Отправляю…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
