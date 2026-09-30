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
  return parseCsvLines(text).map((r) => r.cells);
}

/**
 * То же, но с номером строки файла, где начинается запись: пустые строки и переносы
 * внутри кавычек сдвигают нумерацию, а ошибка должна указывать на строку в Excel.
 */
export function parseCsvLines(text: string): { cells: string[]; line: number }[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);

  const rows: { cells: string[]; line: number }[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let lineNo = 1;
  let rowStart = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (c === "\n") lineNo++;
        field += c;
      }
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push({ cells: row, line: rowStart });
      row = [];
      field = "";
      lineNo++;
      rowStart = lineNo;
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push({ cells: row, line: rowStart });
  }
  return rows.filter((r) => r.cells.some((c) => c.trim() !== ""));
}

function detectDelimiter(text: string): "," | ";" {
  const end = text.indexOf("\n");
  const header = end === -1 ? text : text.slice(0, end);
  const count = (ch: string) => header.split(ch).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

/**
 * Ячейка для CSV-выгрузки. Имя, компания и адрес приходят из публичной формы, а
 * ячейку, которая начинается с = + - @, Excel выполнит как формулу, — апостроф
 * делает её текстом. Телефон из одних цифр («+7 900 …») не опасен, его не трогаем.
 */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s()-]+$/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
