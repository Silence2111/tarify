// Плоские, сериализуемые типы для передачи из серверных компонентов в клиентские.

export type PlanType = "INTERNET" | "TV" | "MOBILE" | "BUNDLE" | "BUSINESS_ACCOUNT";

// Тарифы, которые ищут по адресу дома (нужно покрытие). Мобильная связь и счета
// для бизнеса живут в своих каталогах и в выдачу по адресу не попадают.
export const HOME_PLAN_TYPES = ["INTERNET", "TV", "BUNDLE"] as const satisfies readonly PlanType[];

// В количествах (ГБ, минуты, SMS) -1 означает безлимит.
export const UNLIMITED = -1;

export type PlanView = {
  id: string;
  name: string;
  type: PlanType;
  speedMbps: number | null;
  priceMonthly: number;
  priceFirst: number | null;
  hasTv: boolean;
  tvChannels: number | null;
  hasMobile: boolean;
  mobileGb: number | null;
  minutes: number | null;
  sms: number | null;
  esim: boolean;
  region: string | null;
  url: string | null; // партнёрская ссылка: «Оформить» на сайте оператора
  erid: string | null; // маркировка рекламы
  description: string | null;
  options: { label: string; value: string }[];
  priceChange?: PriceChangeView | null; // подорожал или подешевел недавно
};

/** Последнее изменение цены для карточки тарифа: направление, было, стало, когда. */
export type PriceChangeView = {
  kind: "UP" | "DOWN";
  oldPrice: number;
  newPrice: number;
  at: string; // ISO-строка: карточки рендерятся и в клиентских компонентах
};

export type ProviderGroup = {
  providerId: string;
  providerName: string;
  providerSlug: string;
  techNote: string | null;
  plans: PlanView[];
};

// Тариф в каталоге (мобильная связь, счета для бизнеса): плоский список с оператором.
export type CatalogPlan = PlanView & { providerName: string; providerSlug: string };
