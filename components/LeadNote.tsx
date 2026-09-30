"use client";

import { useState, useTransition } from "react";
import { COMMENT_MAX } from "@/lib/lead-update";

// Заметка оператора к заявке. Кнопка «Сохранить» появляется, когда текст изменён.
// text-base на телефоне: при шрифте меньше 16px iOS увеличивает страницу при вводе.
export function LeadNote({ id, comment }: { id: string; comment: string | null }) {
  const [value, setValue] = useState(comment ?? "");
  const [saved, setSaved] = useState(comment ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const dirty = value.trim() !== saved;

  function save() {
    setError(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: value }),
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { comment: string | null };
        setSaved(data.comment ?? "");
        setValue(data.comment ?? "");
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={value.includes("\n") || value.length > 60 ? 3 : 1}
        maxLength={COMMENT_MAX}
        placeholder="Заметка: когда перезвонить, что ответил клиент"
        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-700 placeholder:text-slate-400 sm:text-sm"
      />
      {dirty && (
        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Сохраняю…" : "Сохранить заметку"}
          </button>
          {error && <span className="text-xs text-red-600">не сохранилось, попробуйте ещё раз</span>}
        </div>
      )}
    </div>
  );
}
