// Базовый URL сайта для канонических ссылок, sitemap и robots.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
