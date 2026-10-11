import { extractDocument } from '../extract/extractDocument';
import { spreadsheetToText } from '../extract/spreadsheet';

export interface RubricFile {
  text: string;
  source: string;
}

/** Lee una rúbrica desde archivo (md, txt, docx, pdf, xlsx, xls, csv) y devuelve su texto. */
export async function readRubricFile(file: File): Promise<RubricFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const data = await file.arrayBuffer();
    return { text: await spreadsheetToText(data), source: file.name };
  }
  if (name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.docx') || name.endsWith('.pdf')) {
    const document = await extractDocument(file);
    const text = document.text.trim();
    if (!text) {
      throw new Error('El archivo no contiene texto extraíble.');
    }
    return { text, source: file.name };
  }
  throw new Error('Formato no compatible para la rúbrica. Usa .md, .txt, .docx, .pdf, .xlsx o .csv.');
}
