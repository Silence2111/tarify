"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Summary = {
  rows: number;
  coverageCreated: number;
  coverageUpdated: number;
  providersCreated: number;
  buildingsCreated: number;
  errors: { line: number; message: string }[];
};

export function CoverageImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setState("uploading");
    setSummary(null);
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/coverage/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(json.error ?? "Ошибка импорта");
        return;
      }
      setSummary(json as Summary);
      setState("done");
      router.refresh(); // обновить статистику покрытия на странице
    } catch {
      setState("error");
      setErrorMsg("Сетевая ошибка");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-800">Импорт покрытия из CSV</div>
      <p className="mt-1 text-xs text-slate-500">
        Колонки: <code>city, street, house, provider</code> (обязательные) +{" "}
        <code>provider_name, tech, payout, source</code> (необязательные). Повторный импорт
        безопасен — дубли не создаются, существующие записи освежаются.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          required
        />
        <button
          type="submit"
          disabled={state === "uploading"}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {state === "uploading" ? "Импорт…" : "Загрузить"}
        </button>
      </div>

      {state === "error" && <div className="mt-2 text-sm text-red-600">{errorMsg}</div>}

      {state === "done" && summary && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>Строк: <b>{summary.rows}</b></span>
            <span className="text-green-700">Добавлено: <b>{summary.coverageCreated}</b></span>
            <span className="text-slate-500">Обновлено: <b>{summary.coverageUpdated}</b></span>
            <span>Домов создано: <b>{summary.buildingsCreated}</b></span>
            <span>Провайдеров создано: <b>{summary.providersCreated}</b></span>
          </div>
          {summary.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-red-600">
              {summary.errors.slice(0, 8).map((er, i) => (
                <li key={i}>
                  строка {er.line}: {er.message}
                </li>
              ))}
              {summary.errors.length > 8 && <li>…ещё {summary.errors.length - 8}</li>}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
