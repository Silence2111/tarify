// Интеграция с DaData (адресный слой ФИАС/ГАР).
// Включается, когда задан DADATA_API_KEY. Без ключа все функции возвращают null,
// и вызывающий код использует локальную БД как fallback.
//
// Зачем: локальная таблица улиц покрывает только засеянные города. DaData даёт
// подсказки адресов по всей РФ с привязкой к ФИАС — это и есть «адресный слой»
// из дорожной карты. Матрица покрытия (какой провайдер в доме) остаётся нашей.

import { slugify } from "@/lib/format";

const SUGGEST_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";

export type StreetSuggestion = { id: string; slug: string; name: string };

type DaDataAddress = {
  value: string;
  data: {
    street_with_type?: string | null;
    street?: string | null;
    street_fias_id?: string | null;
    fias_id?: string | null;
    city?: string | null;
    settlement_with_type?: string | null;
  };
};

function getKey(): string | null {
  const key = process.env.DADATA_API_KEY?.trim();
  return key ? key : null;
}

export function isDaDataEnabled(): boolean {
  return getKey() !== null;
}

// Подсказки улиц внутри города. Возвращает null, если DaData не настроена —
// тогда вызывающий код берёт улицы из локальной БД.
export async function suggestStreetsViaDaData(
  cityName: string,
  query: string,
): Promise<StreetSuggestion[] | null> {
  const key = getKey();
  if (!key) return null;
  if (query.trim().length < 2) return [];

  try {
    const res = await fetch(SUGGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${key}`,
      },
      body: JSON.stringify({
        query,
        count: 8,
        // Ограничиваем выдачу выбранным городом.
        locations: [{ city: cityName }, { settlement: cityName }],
        // Только улицы (без домов/квартир).
        from_bound: { value: "street" },
        to_bound: { value: "street" },
        restrict_value: true,
      }),
      // Подсказки не должны вешать запрос надолго.
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { suggestions?: DaDataAddress[] };
    const suggestions = json.suggestions ?? [];

    const seen = new Set<string>();
    const out: StreetSuggestion[] = [];
    for (const s of suggestions) {
      const name = s.data.street_with_type || s.data.street || s.value;
      if (!name) continue;
      const id = s.data.street_fias_id || s.data.fias_id || name;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, slug: slugify(name), name });
    }
    return out;
  } catch {
    // Сеть/таймаут/ключ — молча уходим в fallback.
    return null;
  }
}
