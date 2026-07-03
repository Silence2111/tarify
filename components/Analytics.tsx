import Script from "next/script";

// Privacy-friendly аналитика Plausible. Включается, если задан
// NEXT_PUBLIC_PLAUSIBLE_DOMAIN. Без cookie-баннера (не использует куки).
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
