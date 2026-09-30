// Минимальный CSV-парсер с поддержкой кавычек и экранирования "".
// Общий для импорта покрытия и тарифов.
//
// Файлы готовят в Excel/Google Таблицах, поэтому:
//  - BOM в начале (Excel, «CSV UTF-8») отрезаем — иначе первая колонка
//    заголовка не узнаётся;
//  - разделитель определяем по заголовку: русский Excel сохраняет CSV через «;».
//    В названиях колонок нет ни запятых, ни точек с запятой, так что заголовок
//    однозначно говорит, какой из них разделитель.
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function detectDelimiter(text: string): "," | ";" {
  const end = text.indexOf("\n");
  const header = end === -1 ? text : text.slice(0, end);
  const count = (ch: string) => header.split(ch).length - 1;
  return count(";") > count(",") ? ";" : ",";
}
