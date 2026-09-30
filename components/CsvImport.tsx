"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export type ImportStat = { key: string; label: string; tone?: "good" | "muted" };

type ImportResult = Record<string, unknown> & {
  error?: string;
  errors?: { line: number; message: string }[];
};

const TONE = { good: "text-green-700", muted: "text-slate-500" } as const;

// Загрузка CSV в админке: файл → POST на endpoint → сводка импорта.
// Какие числа из ответа показать, задаёт stats; ошибки по строкам показываются
// и при частичном импорте (покрытие), и при отказе целиком (тарифы, 422).
export function CsvImport({
  endpoint,
  title,
  hint,
  stats,
}: {
  endpoint: string;
  title: string;
  hint: React.ReactNode;
  stats: ImportStat[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setState("uploading");
    setResult(null);
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = (await res.json()) as ImportResult;
      setResult(json);
      if (!res.ok) {
        setState("error");
        setErrorMsg(json.error ?? "Ошибка импорта");
        return;
      }
      setState("done");
      router.refresh(); // обновить статистику на странице
    } catch {
      setState("error");
      setErrorMsg("Сетевая ошибка");
    }
  }

  const errors = result?.errors ?? [];

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-800">{title}</div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
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

      {state === "done" && result && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          {stats.map((s) => (
            <span key={s.key} className={s.tone ? TONE[s.tone] : undefined}>
              {s.label}: <b>{String(result[s.key] ?? 0)}</b>
            </span>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-red-600">
          {errors.slice(0, 8).map((er, i) => (
            <li key={i}>
              строка {er.line}: {er.message}
            </li>
          ))}
          {errors.length > 8 && <li>…ещё {errors.length - 8}</li>}
        </ul>
      )}
    </form>
  );
}
