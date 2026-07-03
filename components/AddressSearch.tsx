"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type City = { id: string; slug: string; name: string };
type StreetSuggestion = { id: string; slug: string; name: string };

export function AddressSearch({ cities }: { cities: City[] }) {
  const router = useRouter();
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? "");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [chosenStreet, setChosenStreet] = useState<StreetSuggestion | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Автокомплит улицы по мере ввода.
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
        }
      } catch {
        /* тихо игнорируем — это подсказки */
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!citySlug || !street.trim()) return;
    const params = new URLSearchParams({ street: street.trim() });
    if (house.trim()) params.set("house", house.trim());
    router.push(`/${citySlug}/search?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <select
        value={citySlug}
        onChange={(e) => {
          setCitySlug(e.target.value);
          setChosenStreet(null);
        }}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm sm:w-40"
      >
        {cities.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      <div ref={boxRef} className="relative flex-1">
        <input
          type="text"
          placeholder="Улица"
          value={street}
          onChange={(e) => {
            setStreet(e.target.value);
            setChosenStreet(null);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStreet(s.name);
                    setChosenStreet(s);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        type="text"
        placeholder="Дом"
        value={house}
        onChange={(e) => setHouse(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm sm:w-24"
        autoComplete="off"
      />

      <button
        type="submit"
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Проверить
      </button>
    </form>
  );
}
