"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { metrikaId, trackGoal } from "@/lib/analytics";

// Метрика в приложении без перезагрузок: просмотр страницы при переходе по сайту
// (первый засчитывает сам счётчик) и цель partner_click при нажатии «Оформить» —
// ссылки /go/… есть и в серверных карточках, поэтому ловим клик на документе.
export function MetrikaTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = metrikaId();
    const ym = (window as Window & { ym?: (...a: unknown[]) => void }).ym;
    if (id && ym) ym(id, "hit", window.location.href, { referer: document.referrer });
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.('a[href^="/go/"]');
      if (link) trackGoal("partner_click");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
