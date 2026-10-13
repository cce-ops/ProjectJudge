import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { spreadsheetToText } from './spreadsheet';

function sheetXml(rows: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

function cell(ref: string, value: string, type?: string): string {
  const t = type ? ` t="${type}"` : '';
  return `<c r="${ref}"${t}><v>${value}</v></c>`;
}

async function buildWorkbook(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `</Types>`
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Rubrica" sheetId="1" r:id="rId1"/>` +
      `<sheet name="Notas" sheetId="2" r:id="rId2"/></sheets></workbook>`
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
      `</Relationships>`
  );
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5">` +
      `<si><t>Criterio</t></si><si><t>Puntos</t></si><si><t>Rigor tecnico</t></si>` +
      `<si><t>Claridad</t></si><si><t>Nota: evaluar con rigor.</t></si></sst>`
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    sheetXml(
      `<row r="1">${cell('A1', '0', 's')}${cell('B1', '1', 's')}</row>` +
        `<row r="2">${cell('A2', '2', 's')}${cell('B2', '10')}</row>` +
        `<row r="3">${cell('A3', '3', 's')}${cell('B3', '5')}</row>`
    )
  );
  zip.file(
    'xl/worksheets/sheet2.xml',
    sheetXml(`<row r="1">${cell('A1', '4', 's')}</row>`)
  );
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return buffer as ArrayBuffer;
}

describe('spreadsheetToText', () => {
  it('convierte las hojas en texto con sus valores', async () => {
    const text = await spreadsheetToText(await buildWorkbook());
    expect(text).toContain('# Rubrica');
    expect(text).toContain('# Notas');
    expect(text).toContain('Rigor tecnico');
    expect(text).toContain('10');
    expect(text).toContain('Claridad');
    expect(text).toContain('Nota: evaluar con rigor.');
  });

  it('lee un csv como texto', async () => {
    const csv = new TextEncoder().encode('Criterio,Puntos\nRigor tecnico,10\n');
    const text = await spreadsheetToText(csv.buffer as ArrayBuffer);
    expect(text).toContain('Rigor tecnico');
    expect(text).toContain('10');
  });

  it('lanza un error claro con datos invalidos', async () => {
    await expect(spreadsheetToText(new ArrayBuffer(8))).rejects.toThrow();
  });
});
