"use client";

import { useState } from "react";

export function LeadForm({
  planId,
  providerName,
  planName,
  addressText,
  buildingId,
}: {
  planId: string;
  providerName: string;
  planName: string;
  addressText: string;
  buildingId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, planId, buildingId, addressText, consent }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        Заявка принята! Перезвоним и согласуем подключение «{providerName} — {planName}».
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Подключить
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          required
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-32"
        />
        <input
          required
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-44"
        />
        <button
          type="submit"
          disabled={state === "sending" || !consent}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {state === "sending" ? "Отправка…" : "Жду звонка"}
        </button>
        {state === "error" && (
          <span className="text-sm text-red-600">Ошибка, попробуйте ещё раз</span>
        )}
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Согласен на обработку персональных данных согласно{" "}
          <a href="/privacy" target="_blank" className="text-brand underline">
            политике конфиденциальности
          </a>
          .
        </span>
      </label>
    </form>
  );
}
