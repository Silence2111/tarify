import { siteUrl } from "@/lib/site";

// robots.txt текстом, а не через MetadataRoute.Robots: так можно добавить Clean-param.
// Без «Allow: /»: доступ и так разрешён, а парсеры, берущие первое совпавшее правило
// (urllib.robotparser и подобные), из-за неё считали открытыми и /admin, и /go/.
// Clean-param — для Яндекса: рекламные метки не делают страницу новой. Google директиву
// пропускает, ему хватает canonical.
export function GET() {
  const body = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /api",
    "Disallow: /go/",
    "",
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid",
    "",
    `Sitemap: ${siteUrl()}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
