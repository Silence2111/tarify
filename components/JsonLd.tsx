import { siteUrl } from "@/lib/site";

// Микроразметка Schema.org. «<» экранируем: название улицы или тарифа из CSV с
// «</script>» иначе закрыло бы тег и вставило бы в страницу свой код.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export type Crumb = { name: string; path?: string };

/** BreadcrumbList по видимым «хлебным крошкам» страницы; у последней ссылки нет. */
export function breadcrumbs(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: new URL(c.path, siteUrl()).toString() } : {}),
    })),
  };
}
