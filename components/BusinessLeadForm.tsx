"use client";

import { useState } from "react";
import { ConsentCheckbox } from "./ConsentCheckbox";

// Заявка «интернет и связь в офис». Провайдеров по зданию подбирают при звонке,
// передают оператору через его B2B-партнёрку (МТС Агенты, МегаФон и т. п.).
export function BusinessLeadForm() {
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, addressText: address, name, phone, consent }),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "Не получилось отправить заявку");
      setState("error");
    } catch {
      setError("Сетевая ошибка, попробуйте ещё раз");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
        Заявка принята. Перезвоним, уточним здание и пришлём варианты подключения офиса.
      </div>
    );
  }

  const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          id="biz-company"
          required
          placeholder="Компания или ИП"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={input}
        />
        <input
          id="biz-address"
          required
          placeholder="Адрес офиса"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={input}
        />
        <input
          id="biz-name"
          required
          placeholder="Контактное лицо"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
        <input
          id="biz-phone"
          required
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={input}
        />
      </div>
      <ConsentCheckbox id="biz-consent" checked={consent} onChange={setConsent} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={state === "sending" || !consent}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {state === "sending" ? "Отправка…" : "Подобрать интернет для офиса"}
        </button>
        {state === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
