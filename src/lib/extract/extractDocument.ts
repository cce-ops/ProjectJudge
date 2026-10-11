import type { ExtractedDocument } from '../../types/extract';
import { markdownToModel } from './markdown';
import { pdfPagesToModel } from './pdfModel';
import { documentXmlToModel } from './docxModel';
import JSZip from 'jszip';

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.md') || name.endsWith('.txt')) {
    const text = await file.text();
    const { sections, figures, warnings } = markdownToModel(text);
    return {
      fileName: file.name,
      format: name.endsWith('.md') ? 'md' : 'txt',
      text,
      sections,
      figures,
      warnings,
      stats: { pages: undefined, words: text.split(/\s+/).filter(Boolean).length, figuresUsed: 0, figuresDiscarded: 0 },
    };
  }
  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    const mediaFiles = Object.values(zip.files).filter(f => f.name.startsWith('word/media/'));
    const media: Record<string, any> = {};
    for (const f of mediaFiles) {
      const base64 = await f.async('base64');
      media[f.name.split('/').pop() || ''] = { base64, mimeType: 'image/png', width: 0, height: 0, bytes: 0, hash: '' };
    }
    const xmlString = documentXml || '';
    const { sections, figureCandidates, warnings } = documentXmlToModel(xmlString, media);
    return {
      fileName: file.name,
      format: 'docx',
      text: sections.map(s => s.title + ': ' + s.text).join('\n'),
      sections,
      figures: figureCandidates,
      warnings,
      stats: { pages: undefined, words: 0, figuresUsed: 0, figuresDiscarded: 0 },
    };
  }
  if (name.endsWith('.pdf')) {
    // En el envoltorio real usaríamos pdfjs; aquí usamos el modelo simplificado
    // Para que no falle, devolvemos un documento vacío con aviso
    return {
      fileName: file.name,
      format: 'pdf',
      text: '',
      sections: [],
      figures: [],
      warnings: ['PDF: usar pdfPagesToModel en pdf.ts'],
      stats: { pages: 0, words: 0, figuresUsed: 0, figuresDiscarded: 0 },
    };
  }
  throw new Error('Formato no compatible. Usa .pdf, .docx, .md o .txt');
}

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.md') || name.endsWith('.txt');
}
