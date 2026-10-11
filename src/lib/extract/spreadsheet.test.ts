import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { spreadsheetToText } from './spreadsheet';

function buildWorkbook(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const criteria = XLSX.utils.aoa_to_sheet([
    ['Criterio', 'Puntos'],
    ['Rigor tecnico', 10],
    ['Claridad', 5],
  ]);
  XLSX.utils.book_append_sheet(workbook, criteria, 'Rubrica');
  const notes = XLSX.utils.aoa_to_sheet([['Nota: evaluar con rigor.']]);
  XLSX.utils.book_append_sheet(workbook, notes, 'Notas');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer;
}

describe('spreadsheetToText', () => {
  it('convierte las hojas en texto con sus valores', async () => {
    const text = await spreadsheetToText(buildWorkbook());
    expect(text).toContain('Rigor tecnico');
    expect(text).toContain('10');
    expect(text).toContain('Claridad');
    expect(text).toContain('Nota: evaluar con rigor.');
  });

  it('lanza un error claro con datos invalidos', async () => {
    await expect(spreadsheetToText(new ArrayBuffer(8))).rejects.toThrow();
  });
});
