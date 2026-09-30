export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

/** «30 сентября 2026 г.» — по Москве, как и остальные даты сайта (сервер Vercel живёт в UTC). */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = [
  "янв.", "февр.", "марта", "апр.", "мая", "июня",
  "июля", "авг.", "сент.", "окт.", "нояб.", "дек.",
];
const MSK_OFFSET = 3 * 60 * 60 * 1000; // Москва — UTC+3 круглый год

// Даты по московскому времени и без Intl: одинаково на сервере (UTC на Vercel) и в
// браузере в любом часовом поясе — карточки тарифов рендерятся и там, и там.
function moscow(value: Date | string): Date {
  return new Date(new Date(value).getTime() + MSK_OFFSET);
}

/** «12 сент.» */
export function formatShortDate(value: Date | string): string {
  const d = moscow(value);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** «12 сент., 14:05» — год только не текущий: «12 сент. 2025, 14:05». Для админки. */
export function formatDateTime(value: Date | string, now: Date = new Date()): string {
  const d = moscow(value);
  const year = d.getUTCFullYear() === moscow(now).getUTCFullYear() ? "" : ` ${d.getUTCFullYear()}`;
  const time = [d.getUTCHours(), d.getUTCMinutes()].map((n) => String(n).padStart(2, "0")).join(":");
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}${year}, ${time}`;
}

/** «12 сентября 2026» */
export function formatDay(value: Date | string): string {
  const d = moscow(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
