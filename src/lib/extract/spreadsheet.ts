import * as XLSX from 'xlsx';

/** Convierte un libro (xlsx, xls, csv…) en texto plano, una sección por hoja. */
export async function spreadsheetToText(data: ArrayBuffer): Promise<string> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: 'array' });
  } catch {
    throw new Error('No se pudo leer la hoja de cálculo. Usa un archivo .xlsx, .xls o .csv válido.');
  }
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    if (/[A-Za-z0-9À-ÿ]/.test(csv)) {
      parts.push(`# ${sheetName}\n${csv.trim()}`);
    }
  }
  if (parts.length === 0) {
    throw new Error('La hoja de cálculo no contiene datos legibles.');
  }
  return parts.join('\n\n');
}
