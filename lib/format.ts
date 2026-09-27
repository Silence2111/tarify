export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya", " ": "-", ".": "",
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Технология подключения по-русски. В фидах провайдеров приходят коды
 * GPON / FTTB / ADSL — человеку они ничего не говорят, а решение «оптика
 * или медь» для него важное.
 */
const TECH: Record<string, string> = {
  gpon: "оптика в квартиру",
  ftth: "оптика в квартиру",
  fttb: "оптика до дома",
  adsl: "телефонная линия",
  docsis: "кабель ТВ",
};

export function techLabel(note: string | null | undefined): string | null {
  if (!note) return null;
  const key = note.trim().toLowerCase();
  return TECH[key] ?? note.trim();
}

/** Телефон: 10–11 цифр, российский формат. Пустая строка — ошибка. */
export function phoneError(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "Укажите телефон";
  if (digits.length < 10 || digits.length > 11) return "Телефон выглядит неполным — пример: +7 900 123-45-67";
  return null;
}
