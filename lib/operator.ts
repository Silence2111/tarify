// Реквизиты оператора персональных данных и получатели данных — из переменных
// окружения: их вписывают в Vercel, а не в код. Без них в согласии и политике —
// пометка «заполнить», а в «Запуске» — невыполненный пункт.

type Env = Record<string, string | undefined>;

export const OPERATOR_FIELDS = [
  { key: "OPERATOR_NAME", label: "наименование" },
  { key: "OPERATOR_INN", label: "ИНН" },
  { key: "OPERATOR_OGRN", label: "ОГРН или ОГРНИП" },
  { key: "OPERATOR_ADDRESS", label: "адрес" },
  { key: "OPERATOR_EMAIL", label: "e-mail" },
] as const;

const value = (env: Env, key: string) => env[key]?.trim() || null;

/** «ООО «Тарифы», ИНН …, ОГРН …, адрес: …, e-mail: …»; null — наименование не задано. */
export function operatorDetails(env: Env = process.env): string | null {
  const name = value(env, "OPERATOR_NAME");
  if (!name) return null;
  const inn = value(env, "OPERATOR_INN");
  const ogrn = value(env, "OPERATOR_OGRN");
  const address = value(env, "OPERATOR_ADDRESS");
  const email = value(env, "OPERATOR_EMAIL");
  return [
    name,
    inn && `ИНН ${inn}`,
    ogrn && `ОГРН ${ogrn}`,
    address && `адрес: ${address}`,
    email && `e-mail: ${email}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Какие реквизиты не заданы — для «Запуска». */
export function missingOperatorFields(env: Env = process.env): string[] {
  return OPERATOR_FIELDS.filter((f) => !value(env, f.key)).map((f) => f.label);
}

/** Кому передаются заявки: CPA-сети и CRM (PD_RECIPIENTS); null — не задано. */
export function dataRecipients(env: Env = process.env): string | null {
  return value(env, "PD_RECIPIENTS");
}
