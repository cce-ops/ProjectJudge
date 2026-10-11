import * as pdfjsLib from 'pdfjs-dist';
import { pdfPagesToModel, type PdfPageDump } from './pdfModel';
import { selectFigures, reencodeFigure, type CanvasFactory } from './figures';
import type { ExtractedDocument } from '../../types/extract';
import { truncateText } from '../text';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfDependencies {
  getDocument?: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentLike> } | Promise<PdfDocumentLike>;
}

interface PdfDocumentLike {
  numPages: number;
  getPage(i: number): Promise<PdfPageLike>;
  cleanup(): void;
}

interface PdfPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
}

export async function extractPdf(
  file: File,
  deps: PdfDependencies = {}
): Promise<ExtractedDocument> {
  const getDoc = deps.getDocument ?? ((params: { data: ArrayBuffer }) => pdfjsLib.getDocument(params));
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDoc({ data: arrayBuffer });
  const pdf: PdfDocumentLike =
    loadingTask && typeof (loadingTask as { promise?: unknown }).promise !== 'undefined'
      ? await (loadingTask as { promise: Promise<PdfDocumentLike> }).promise
      : await (loadingTask as Promise<PdfDocumentLike>);

  const pages: PdfPageDump[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
    const images: { name: string; width: number; height: number; hash: string }[] = [];
    pages.push({ pageNumber: i, lines: lines.split('. '), images });
  }
  pdf.cleanup();

  const modelResult = pdfPagesToModel(pages, [
    'introducción', 'antecedentes', 'objetivos', 'metodología', 'planificación',
    'presupuesto', 'normativa', 'riesgos', 'conclusiones', 'bibliografía', 'anexos',
  ]);

  const text = modelResult.sections.map(s => s.text).join(' ');
  const truncatedText = truncateText(text, 60000);

  const figureCandidates = modelResult.figureCandidates.map((c, idx) => ({
    ...c,
    id: `fig-candidate-${idx}`,
  }));
  const { figures, discarded } = selectFigures(figureCandidates);

  return {
    fileName: file.name,
    format: 'pdf',
    text: truncatedText.text,
    sections: modelResult.sections,
    figures,
    warnings: [...modelResult.warnings, ...(truncatedText.truncated ? ['Texto recortado a 60.000 caracteres.'] : [])],
    stats: {
      pages: pdf.numPages,
      words: truncatedText.text.split(/\s+/).filter(Boolean).length,
      figuresUsed: figures.length,
      figuresDiscarded: modelResult.figureCandidates.length - figures.length + discarded,
    },
  };
}
