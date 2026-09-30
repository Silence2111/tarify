// Галочка согласия на обработку персональных данных. С 1 сентября 2025 года
// согласие оформляется отдельным документом, а не пунктом политики
// конфиденциальности, — поэтому ссылка ведёт на /soglasie. Передача заявки
// провайдеру названа прямо: без неё подключения не будет.
export function ConsentCheckbox({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-xs text-slate-500">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        Даю{" "}
        <a href="/soglasie" target="_blank" className="text-brand underline">
          согласие на обработку персональных данных
        </a>{" "}
        и их передачу выбранному провайдеру для подключения. Как мы храним данные — в{" "}
        <a href="/privacy" target="_blank" className="text-brand underline">
          политике конфиденциальности
        </a>
        .
      </span>
    </label>
  );
}
