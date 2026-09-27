"use client";

import { useId, useState } from "react";
import { phoneError } from "@/lib/format";

/**
 * Заявка на подключение (или на ручной подбор, если planId не задан).
 *
 * Было: поля без подписей, «Ошибка, попробуйте ещё раз» без причины,
 * кнопка неактивна без объяснения, почему. Стало: подписи, проверка
 * у поля после ухода из него, текст ошибки сервера, честный успех
 * в демо-режиме.
 */
export function LeadForm({
  planId,
  providerName,
  planName,
  addressText,
  buildingId,
  startOpen = false,
  submitText = "Заказать звонок",
  askAddress = false,
}: {
  planId?: string;
  providerName?: string;
  planName?: string;
  addressText: string;
  buildingId?: string;
  startOpen?: boolean;
  submitText?: string;
  /** Спросить адрес: для ручного подбора, когда дома нет в базе. */
  askAddress?: boolean;
}) {
  const uid = useId();
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean; consent?: boolean }>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const nameErr = touched.name && name.trim().length < 2 ? "Как к вам обращаться?" : null;
  const phoneErr = touched.phone ? phoneError(phone) : null;
  const consentErr = touched.consent && !consent ? "Без согласия мы не можем принять заявку" : null;
  const demo = process.env.NEXT_PUBLIC_DEMO !== "0";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, phone: true, consent: true });
    if (name.trim().length < 2 || phoneError(phone) || !consent) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, planId, buildingId, consent,
          addressText: askAddress && address.trim() ? `${addressText}: ${address.trim()}` : addressText,
        }),
      });
      if (res.ok) { setState("done"); return; }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Не получилось отправить. Попробуйте ещё раз.");
      setState("idle");
    } catch {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-md2 bg-ok-bg px-4 py-3 text-ok" role="status">
        <p className="font-medium">Заявка принята</p>
        <p className="mt-1 text-sm">
          {demo
            ? "Это демо: заявка сохранилась в админке, но звонка не будет."
            : planName
              ? `Перезвоним и согласуем подключение «${providerName} — ${planName}».`
              : "Перезвоним и подберём тариф вручную."}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-soft w-full sm:w-auto">
        Подключить
      </button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className="label">Имя</label>
          <input
            id={`${uid}-name`}
            placeholder="Анна"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            className="field"
            aria-invalid={Boolean(nameErr)}
          />
          {nameErr && <p className="field-error">{nameErr}</p>}
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className="label">Телефон</label>
          <input
            id={`${uid}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 900 123-45-67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            className="field"
            aria-invalid={Boolean(phoneErr)}
          />
          {phoneErr && <p className="field-error">{phoneErr}</p>}
        </div>
      </div>

      {askAddress && (
        <div>
          <label htmlFor={`${uid}-addr`} className="label">Адрес</label>
          <input
            id={`${uid}-addr`}
            placeholder="Казань, улица Лево-Булачная, 24"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="field"
          />
        </div>
      )}

      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-none accent-brand"
        />
        <span>
          Согласен на обработку персональных данных по{" "}
          <a href="/privacy" target="_blank" className="text-brand-text underline">
            политике
          </a>
        </span>
      </label>
      {consentErr && <p className="field-error -mt-3">{consentErr}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending"} className="btn w-full sm:w-auto">
          {state === "sending" ? "Отправляем…" : submitText}
        </button>
      </div>
      {error && <p className="rounded-md2 bg-err-bg px-4 py-3 text-sm text-err" role="alert">{error}</p>}
    </form>
  );
}
