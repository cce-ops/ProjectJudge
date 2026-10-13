import JSZip from 'jszip';

const READ_ERROR = 'No se pudo leer la hoja de cálculo. Usa un archivo .xlsx o .csv válido.';
const EMPTY_ERROR = 'La hoja de cálculo no contiene datos legibles.';

/** Convierte un libro .xlsx o un .csv en texto plano, una sección por hoja. */
export async function spreadsheetToText(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const isZip =
    bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isZip) {
    const text = new TextDecoder('utf-8').decode(data).trim();
    if (!/[A-Za-z0-9À-ÿ]/.test(text)) throw new Error(EMPTY_ERROR);
    return text;
  }
  return xlsxToText(data);
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error(READ_ERROR);
  return doc;
}

/** Índice de columna (0-based) desde la referencia ("A1" → 0, "B3" → 1, "AA2" → 26). */
function colIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellValue(cell: Element, strings: string[]): string {
  const type = cell.getAttribute('t');
  const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
  if (type === 's') return strings[Number(raw)] ?? '';
  if (type === 'inlineStr' || type === 'str') {
    const runs = cell.getElementsByTagName('t');
    if (runs.length > 0) {
      return Array.from(runs)
        .map((t) => t.textContent ?? '')
        .join('');
    }
    return raw;
  }
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  if (type === 'e') return '';
  return raw;
}

async function xlsxToText(data: ArrayBuffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error(READ_ERROR);
  }
  const workbookFile = zip.file('xl/workbook.xml');
  if (!workbookFile) throw new Error(READ_ERROR);
  const workbook = parseXml(await workbookFile.async('string'));

  const relTargets = new Map<string, string>();
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (relsFile) {
    const rels = parseXml(await relsFile.async('string'));
    for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) relTargets.set(id, target.replace(/^\/?xl\//, ''));
    }
  }

  const strings: string[] = [];
  const sstFile = zip.file('xl/sharedStrings.xml');
  if (sstFile) {
    const sst = parseXml(await sstFile.async('string'));
    for (const si of Array.from(sst.getElementsByTagName('si'))) {
      strings.push(
        Array.from(si.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join('')
      );
    }
  }

  const parts: string[] = [];
  const sheets = Array.from(workbook.getElementsByTagName('sheet'));
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = sheet.getAttribute('name') ?? 'Hoja';
    const rid = sheet.getAttribute('r:id');
    const fallback = `worksheets/sheet${sheet.getAttribute('sheetId') ?? i + 1}.xml`;
    const wsFile = zip.file(`xl/${(rid && relTargets.get(rid)) || fallback}`);
    if (!wsFile) continue;
    let ws: Document;
    try {
      ws = parseXml(await wsFile.async('string'));
    } catch {
      continue;
    }
    const rows: string[] = [];
    for (const row of Array.from(ws.getElementsByTagName('row'))) {
      const cells: string[] = [];
      for (const c of Array.from(row.getElementsByTagName('c'))) {
        const idx = colIndex(c.getAttribute('r') ?? '');
        while (cells.length < idx) cells.push('');
        cells[idx] = cellValue(c, strings);
      }
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      if (cells.length > 0) rows.push(cells.map(csvCell).join(','));
    }
    const csv = rows.join('\n');
    if (/[A-Za-z0-9À-ÿ]/.test(csv)) {
      parts.push(`# ${name}\n${csv.trim()}`);
    }
  }
  if (parts.length === 0) throw new Error(EMPTY_ERROR);
  return parts.join('\n\n');
}
