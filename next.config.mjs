/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // На геостраницах будет много динамики по адресам — оставляем SSR по умолчанию.
  poweredByHeader: false,
  async headers() {
    // Демо-режим — то же условие, что isDemo() в lib/site.ts: выдуманные дома и цены
    // в поиск не пускаем. Как и плашка, снимается только пересборкой с NEXT_PUBLIC_DEMO=0.
    const demo = process.env.NEXT_PUBLIC_DEMO !== "0";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          ...(demo ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
