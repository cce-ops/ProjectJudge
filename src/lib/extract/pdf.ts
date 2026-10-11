import * as pdfjsLib from 'pdfjs-dist';
import { pdfPagesToModel, type PdfPageDump } from './pdfModel';
import { selectFigures } from './figures';
import type { ExtractedDocument } from '../../types/extract';
import { truncateText } from '../text';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfDependencies {
  getDocument?: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentLike> } | Promise<PdfDocumentLike>;
  renderImage?: (image: PdfRawImage) => Promise<EncodedImage | null>;
}

/** Imagen tal como la entrega pdf.js: kind 1 = grises, 2 = RGB, 3 = RGBA. */
export interface PdfRawImage {
  width: number;
  height: number;
  kind: number;
  data: Uint8ClampedArray;
}

export interface EncodedImage {
  base64: string;
  width: number;
  height: number;
  bytes: number;
}

const MAX_PDF_FIGURES = 60;
const MAX_FIGURE_EDGE = 1024;

interface PdfDocumentLike {
  numPages: number;
  getPage(i: number): Promise<PdfPageLike>;
  cleanup(): void;
}

interface PdfPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: { get(name: string): PdfRawImage };
}

/** Convierte una imagen de pdf.js a RGBA de canvas. Devuelve null si no se puede. */
export function pdfImageToRgba(image: PdfRawImage): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } | null {
  const { width, height, kind, data } = image;
  if (!width || !height || !data || data.length === 0) return null;
  if (kind === 3 && data.length >= width * height * 4) {
    return { width, height, data: new Uint8ClampedArray(data.slice(0, width * height * 4)) };
  }
  if (kind === 2 && data.length >= width * height * 3) {
    const rgba = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
    for (let i = 0, o = 0; i < width * height * 3; i += 3, o += 4) {
      rgba[o] = data[i];
      rgba[o + 1] = data[i + 1];
      rgba[o + 2] = data[i + 2];
      rgba[o + 3] = 255;
    }
    return { width, height, data: rgba };
  }
  if (kind === 1 && data.length >= width * height) {
    const rgba = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
    for (let i = 0, o = 0; i < width * height; i++, o += 4) {
      rgba[o] = data[i];
      rgba[o + 1] = data[i];
      rgba[o + 2] = data[i];
      rgba[o + 3] = 255;
    }
    return { width, height, data: rgba };
  }
  return null;
}

function djb2Hash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

/** Renderizado por defecto en el navegador: RGBA a JPEG con lado máximo. */
async function defaultRenderImage(image: PdfRawImage): Promise<EncodedImage | null> {
  const rgba = pdfImageToRgba(image);
  if (!rgba) return null;
  const ratio = rgba.width / rgba.height;
  const width = Math.max(rgba.width, rgba.height) <= MAX_FIGURE_EDGE
    ? rgba.width
    : ratio >= 1
      ? MAX_FIGURE_EDGE
      : Math.round(MAX_FIGURE_EDGE * ratio);
  const height = Math.max(rgba.width, rgba.height) <= MAX_FIGURE_EDGE
    ? rgba.height
    : ratio >= 1
      ? Math.round(MAX_FIGURE_EDGE / ratio)
      : MAX_FIGURE_EDGE;
  const source = document.createElement('canvas');
  source.width = rgba.width;
  source.height = rgba.height;
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) return null;
  sourceCtx.putImageData(new ImageData(rgba.data, rgba.width, rgba.height), 0, 0);
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  const targetCtx = target.getContext('2d');
  if (!targetCtx) return null;
  targetCtx.drawImage(source, 0, 0, width, height);
  const base64 = target.toDataURL('image/jpeg', 0.8).split(',')[1] ?? '';
  if (!base64) return null;
  return { base64, width, height, bytes: Math.round((base64.length * 3) / 4) };
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
  const renderImage = deps.renderImage ?? defaultRenderImage;
  let harvestedFigures = 0;
  let figuresTruncated = false;
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
    const images: PdfPageDump['images'] = [];
    try {
      const opList = await page.getOperatorList();
      const seenOnPage = new Set<string>();
      for (let o = 0; o < opList.fnArray.length && harvestedFigures < MAX_PDF_FIGURES; o++) {
        if (opList.fnArray[o] !== pdfjsLib.OPS.paintImageXObject) continue;
        const name = opList.argsArray[o]?.[0];
        if (typeof name !== 'string' || seenOnPage.has(name)) continue;
        seenOnPage.add(name);
        let raw: PdfRawImage;
        try {
          raw = page.objs.get(name);
        } catch {
          continue;
        }
        const encoded = await renderImage(raw);
        if (!encoded) continue;
        harvestedFigures++;
        images.push({
          name,
          width: encoded.width,
          height: encoded.height,
          hash: djb2Hash(encoded.base64),
          base64: encoded.base64,
          bytes: encoded.bytes,
          mimeType: 'image/jpeg',
        });
      }
      if (harvestedFigures >= MAX_PDF_FIGURES && i < Math.min(pdf.numPages, 30)) {
        figuresTruncated = true;
      }
    } catch {
      // Sin lista de operadores no hay figuras, pero el texto se conserva.
    }
    pages.push({ pageNumber: i, lines: lines.split('. '), images });
  }
  pdf.cleanup();

  const modelResult = pdfPagesToModel(pages, [
    'introducción', 'antecedentes', 'objetivos', 'metodología', 'planificación',
    'presupuesto', 'normativa', 'riesgos', 'conclusiones', 'bibliografía', 'anexos',
  ]);

  const text = modelResult.sections.map(s => s.text).join(' ');
  const truncatedText = truncateText(text, 60000);

  const figureCandidates = modelResult.figureCandidates;
  const { figures, discarded } = selectFigures(figureCandidates);

  const warnings = [...modelResult.warnings];
  if (truncatedText.truncated) warnings.push('Texto recortado a 60.000 caracteres.');
  if (figuresTruncated) warnings.push(`Se omitieron figuras por límite de memoria (máximo ${MAX_PDF_FIGURES}).`);

  return {
    fileName: file.name,
    format: 'pdf',
    text: truncatedText.text,
    sections: modelResult.sections,
    figures,
    warnings,
    stats: {
      pages: pdf.numPages,
      words: truncatedText.text.split(/\s+/).filter(Boolean).length,
      figuresUsed: figures.length,
      figuresDiscarded: discarded,
    },
  };
}
