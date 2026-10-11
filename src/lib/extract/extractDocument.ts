import type { ExtractedDocument } from '../../types/extract';
import { markdownToModel } from './markdown';
import { documentXmlToModel, type DocxMedia } from './docxModel';
import { selectFigures } from './figures';
import { extractPdf } from './pdf';
import JSZip from 'jszip';

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

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
      stats: { pages: undefined, words: countWords(text), figuresUsed: 0, figuresDiscarded: 0 },
    };
  }
  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    const mediaFiles = Object.values(zip.files).filter((f) => f.name.startsWith('word/media/'));
    const media: Record<string, DocxMedia> = {};
    for (const f of mediaFiles) {
      const base64 = await f.async('base64');
      media[f.name.split('/').pop() || ''] = {
        base64,
        mimeType: 'image/png',
        width: 0,
        height: 0,
        bytes: 0,
        hash: f.name,
      };
    }
    const xmlString = documentXml || '';
    const { sections, figureCandidates, warnings } = documentXmlToModel(xmlString, media);
    const { figures, discarded } = selectFigures(figureCandidates);
    const text = sections.map((s) => `${s.title}: ${s.text}`).join('\n');
    return {
      fileName: file.name,
      format: 'docx',
      text,
      sections,
      figures,
      warnings,
      stats: { pages: undefined, words: countWords(text), figuresUsed: figures.length, figuresDiscarded: discarded },
    };
  }
  if (name.endsWith('.pdf')) {
    return extractPdf(file);
  }
  throw new Error('Formato no compatible. Usa .pdf, .docx, .md o .txt');
}

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.md') || name.endsWith('.txt');
}
