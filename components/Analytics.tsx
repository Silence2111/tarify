import Script from "next/script";
import { metrikaId } from "@/lib/analytics";
import { MetrikaTracker } from "./MetrikaTracker";

// Аналитика. Plausible — если задан NEXT_PUBLIC_PLAUSIBLE_DOMAIN (без cookie).
// Яндекс Метрика — если задан NEXT_PUBLIC_YANDEX_METRIKA_ID: основной счётчик для
// аудитории из России, с целями «заявка» и «Оформить» (lib/analytics.ts). Вебвизор
// выключен: он записывал бы ввод имени и телефона в формах.
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const ym = metrikaId();
  return (
    <>
      {domain && (
        <Script
          defer
          data-domain={domain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      )}
      {ym && (
        <>
          <Script id="yandex-metrika" strategy="afterInteractive">
            {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${ym},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://mc.yandex.ru/watch/${ym}`}
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </noscript>
          <MetrikaTracker />
        </>
      )}
    </>
  );
}
