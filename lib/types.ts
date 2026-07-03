// Плоские, сериализуемые типы для передачи из серверных компонентов в клиентские.

export type PlanView = {
  id: string;
  name: string;
  type: "INTERNET" | "TV" | "MOBILE" | "BUNDLE";
  speedMbps: number | null;
  priceMonthly: number;
  priceFirst: number | null;
  hasTv: boolean;
  tvChannels: number | null;
  hasMobile: boolean;
  mobileGb: number | null;
  description: string | null;
  options: { label: string; value: string }[];
};

export type ProviderGroup = {
  providerId: string;
  providerName: string;
  providerSlug: string;
  techNote: string | null;
  plans: PlanView[];
};
