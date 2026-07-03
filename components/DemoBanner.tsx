// Честная плашка о демо-данных. Скрыть можно, выставив NEXT_PUBLIC_DEMO=0.
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO === "0") return null;
  return (
    <div className="bg-amber-50 text-amber-800">
      <div className="mx-auto max-w-5xl px-4 py-1.5 text-center text-xs">
        Демо-режим: провайдеры, тарифы и покрытие по адресам — примерные, не для реальных
        подключений.
      </div>
    </div>
  );
}
