"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type City = { id: string; slug: string; name: string };
type StreetSuggestion = { id: string; slug: string; name: string };

/**
 * Поиск по адресу: город, улица с подсказками, дом.
 *
 * Было: поля без подписей, а при пустой улице кнопка «Проверить» молча
 * ничего не делала. Стало: подписи над полями, пример в placeholder,
 * ошибка у поля, подсказки улиц с клавиатуры, отдельная подсказка
 * «попробуйте демо-адрес», чтобы показ не упирался в угадывание улиц.
 */
export function AddressSearch({
  cities,
  examples = [],
}: {
  cities: City[];
  examples?: { street: string; house: string }[];
}) {
  const router = useRouter();
  const uid = useId();
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? "");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [chosenStreet, setChosenStreet] = useState<StreetSuggestion | null>(null);
  const [streetError, setStreetError] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!citySlug || street.trim().length < 2 || chosenStreet?.name === street) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/streets?city=${encodeURIComponent(citySlug)}&q=${encodeURIComponent(street)}`,
        );
        if (res.ok) {
          setSuggestions(await res.json());
          setOpen(true);
          setActive(-1);
        }
      } catch {
        /* подсказки не критичны: адрес можно ввести и без них */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [street, citySlug, chosenStreet]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(streetName: string, houseNo: string) {
    const params = new URLSearchParams({ street: streetName.trim() });
    if (houseNo.trim()) params.set("house", houseNo.trim());
    setGoing(true);
    router.push(`/${citySlug}/search?${params.toString()}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!street.trim()) {
      setStreetError("Укажите улицу — например, улица Баумана");
      return;
    }
    go(street, house);
  }

  function pick(s: StreetSuggestion) {
    setStreet(s.name);
    setChosenStreet(s);
    setOpen(false);
    setStreetError(null);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(suggestions[active]); }
    if (e.key === "Escape") setOpen(false);
  }

  const listId = `${uid}-streets`;

  return (
    <div>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[160px_1fr_110px_auto] sm:items-start">
        <div>
          <label htmlFor={`${uid}-city`} className="label">Город</label>
          <select
            id={`${uid}-city`}
            value={citySlug}
            onChange={(e) => { setCitySlug(e.target.value); setChosenStreet(null); }}
            className="field"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        <div ref={boxRef} className="relative">
          <label htmlFor={`${uid}-street`} className="label">Улица</label>
          <input
            id={`${uid}-street`}
            type="text"
            placeholder="улица Баумана"
            value={street}
            onChange={(e) => { setStreet(e.target.value); setChosenStreet(null); if (streetError) setStreetError(null); }}
            onFocus={() => suggestions.length && setOpen(true)}
            onKeyDown={onKey}
            className="field"
            autoComplete="off"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-invalid={Boolean(streetError)}
            aria-describedby={streetError ? `${uid}-street-err` : undefined}
          />
          {streetError && <p id={`${uid}-street-err`} className="field-error">{streetError}</p>}
          {open && suggestions.length > 0 && (
            <ul id={listId} role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md2 bg-panel py-1 shadow-card ring-1 ring-line">
              {suggestions.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className={`block min-h-[44px] w-full px-4 text-left text-base hover:bg-tint ${i === active ? "bg-tint" : ""}`}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor={`${uid}-house`} className="label">Дом</label>
          <input
            id={`${uid}-house`}
            type="text"
            inputMode="text"
            placeholder="3"
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            className="field"
            autoComplete="off"
          />
        </div>

        <div className="sm:pt-[26px]">
          <button type="submit" className="btn w-full" disabled={going}>
            {going ? "Ищем…" : "Показать тарифы"}
          </button>
        </div>
      </form>

      {examples.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <span>Демо-адреса:</span>
          {examples.map((ex) => (
            <button
              key={`${ex.street}-${ex.house}`}
              type="button"
              onClick={() => { setStreet(ex.street); setHouse(ex.house); go(ex.street, ex.house); }}
              className="btn-soft min-h-[44px] px-4 text-sm"
            >
              {ex.street}, {ex.house}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
