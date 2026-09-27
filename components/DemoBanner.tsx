// Честная плашка о демо-данных. Скрыть можно, выставив NEXT_PUBLIC_DEMO=0,
// когда в базе появится настоящее покрытие из партнёрских фидов.
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO === "0") return null;
  return (
    <div className="bg-warn-bg text-warn" role="note">
      <div className="mx-auto max-w-5xl px-4 py-2 text-center text-sm">
        <b className="font-semibold">Демо.</b> Один город — Казань, пять улиц в центре. Провайдеры
        и цены вымышленные. Заявки сохраняются, но никто не перезвонит.
      </div>
    </div>
  );
}
