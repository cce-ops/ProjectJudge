import * as pdfjsLib from 'pdfjs-dist';
import { pdfPagesToModel, type PdfPageDump } from './pdfModel';
import { selectFigures } from './figures';
import { findFigureCitations } from '../text';
import type { ExtractedDocument } from '../../types/extract';
import { truncateText } from '../text';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfDependencies {
  getDocument?: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocumentLike> } | Promise<PdfDocumentLike>;
  renderImage?: (image: PdfRawImage) => Promise<EncodedImage | null>;
  renderPage?: (page: PdfPageLike, scale: number) => Promise<EncodedImage | null>;
  maxRenderedPages?: number;
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
const PAGE_RENDER_SCALE = 1.5;
const MAX_RENDERED_PAGES = 6;
const MAX_SECTION_FIGURES = 3;

/** Páginas cuyo texto contiene el pie de alguna de las figuras citadas. Primero las
 *  que empiezan línea con el pie ("Figura 7: ..."), que suelen ser la página de la
 *  figura, y después las que solo la mencionan en el texto. */
export function findCaptionPages(
  pages: { pageNumber: number; lines: string[] }[],
  cited: number[]
): number[] {
  const starts: number[] = [];
  const mentions: number[] = [];
  for (const page of pages) {
    const text = page.lines.join('\n');
    if (!cited.some((n) => new RegExp(`(?:Figura|Fig\\.)\\s*${n}\\b`).test(text))) continue;
    const isCaption = cited.some((n) => new RegExp(`^\\s*(?:Figura|Fig\\.)\\s*${n}\\b`, 'm').test(text));
    (isCaption ? starts : mentions).push(page.pageNumber);
  }
  const ordered = [...starts.sort((a, b) => a - b)];
  for (const pageNumber of mentions.sort((a, b) => a - b)) {
    if (!ordered.includes(pageNumber)) ordered.push(pageNumber);
  }
  return ordered;
}

/** Renderizado de página completa en el navegador (reserva para figuras vectoriales). */
async function defaultRenderPage(page: PdfPageLike, scale: number): Promise<EncodedImage | null> {
  try {
    const viewport = page.getViewport?.({ scale });
    if (!viewport) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const task = page.render?.({ canvasContext: ctx, viewport: viewport as never });
    if (!task) return null;
    await task.promise;
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1] ?? '';
    if (!base64) return null;
    return { base64, width: canvas.width, height: canvas.height, bytes: Math.round((base64.length * 3) / 4) };
  } catch {
    return null;
  }
}

interface PdfDocumentLike {
  numPages: number;
  getPage(i: number): Promise<PdfPageLike>;
  cleanup(): void;
}

interface PdfPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: { get(name: string): PdfRawImage };
  getViewport?: (params: { scale: number }) => { width: number; height: number };
  render?: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
}

export interface PdfTextItem {
  str: string;
  transform?: number[];
  width?: number;
}

/**
 * Reconstruye las líneas visuales de una página a partir de los fragmentos de
 * pdf.js: agrupa por coordenada Y (origen abajo-izquierda, tolerancia 2 unidades),
 * ordena por X y une con espacio solo cuando el hueco lo justifica. Así no se pegan
 * números de página al texto vecino ni se parten frases por ". ".
 */
interface PositionedItem {
  str: string;
  tx: number;
  ty: number;
  width: number | undefined;
}

/**
 * Reconstruye las líneas visuales de una página a partir de los fragmentos de
 * pdf.js: agrupa por coordenada Y (origen abajo-izquierda, tolerancia 2 unidades),
 * ordena por X y une con espacio solo cuando el hueco lo justifica. Así no se pegan
 * números de página al texto vecino ni se parten frases por ". ".
 */
export function groupTextItemsIntoLines(items: PdfTextItem[]): string[] {
  const withPos: PositionedItem[] = [];
  const withoutPos: string[] = [];
  for (const item of items) {
    const transform = item.transform;
    if (
      typeof item.str === 'string' &&
      Array.isArray(transform) &&
      transform.length >= 6 &&
      Number.isFinite(transform[4]) &&
      Number.isFinite(transform[5])
    ) {
      withPos.push({
        str: item.str,
        tx: transform[4] as number,
        ty: transform[5] as number,
        width: typeof item.width === 'number' && Number.isFinite(item.width) ? item.width : undefined,
      });
    } else if (typeof item.str === 'string') {
      withoutPos.push(item.str);
    }
  }

  const lines: string[] = [];
  const sorted = [...withPos].sort((a, b) => b.ty - a.ty);
  let current: PositionedItem[] = [];
  let currentY = NaN;
  const flush = (): void => {
    if (current.length === 0) return;
    current.sort((a, b) => a.tx - b.tx);
    let text = '';
    let prevEnd = NaN;
    for (const item of current) {
      if (!item.str) continue;
      if (text) {
        const gap = item.tx - prevEnd;
        // Hueco mínimo: el fragmento continúa la palabra anterior ("renovabl"+"e").
        text += Number.isFinite(gap) && gap <= 1 ? '' : ' ';
      }
      text += item.str;
      prevEnd = item.width === undefined ? NaN : item.tx + item.width;
    }
    if (text.trim()) lines.push(text.trim());
    current = [];
  };
  for (const item of sorted) {
    if (current.length > 0 && Math.abs(item.ty - currentY) > 2) {
      flush();
    }
    if (current.length === 0) currentY = item.ty;
    current.push(item);
  }
  flush();

  if (withoutPos.length > 0) {
    const fallback = withoutPos.join(' ').trim();
    if (fallback) lines.push(fallback);
  }
  return lines;
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
  const pageObjects = new Map<number, PdfPageLike>();
  const renderImage = deps.renderImage ?? defaultRenderImage;
  let harvestedFigures = 0;
  let figuresTruncated = false;
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    pageObjects.set(i, page);
    const content = await page.getTextContent();
    const lines = groupTextItemsIntoLines(content.items as PdfTextItem[]);
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
    pages.push({ pageNumber: i, lines, images });
  }

  const modelResult = pdfPagesToModel(pages, [
    'introducción', 'antecedentes', 'objetivos', 'metodología', 'planificación',
    'presupuesto', 'normativa', 'riesgos', 'conclusiones', 'bibliografía', 'anexos',
  ]);

  const text = modelResult.sections.map(s => s.text).join(' ');
  const truncatedText = truncateText(text, 60000);

  const figureCandidates = modelResult.figureCandidates;
  const { figures, discarded } = selectFigures(figureCandidates);

  // Reserva para figuras vectoriales (p. ej. gráficos de MATLAB): si una sección cita
  // figuras pero no se cosechó ninguna imagen ráster, se renderizan como imagen las
  // páginas que contienen sus pies de figura, con topes estrictos de cuota y memoria.
  const renderPage = deps.renderPage ?? defaultRenderPage;
  const maxRenderedPages = deps.maxRenderedPages ?? MAX_RENDERED_PAGES;
  const renderedPages = new Map<number, string>();
  for (const section of modelResult.sections) {
    const cited = findFigureCitations(section.text);
    if (cited.length === 0) continue;
    const linked = (section.figureIds ?? []).filter((id) => figures.some((f) => f.id === id));
    if (linked.length > 0) continue;
    const captionPages = findCaptionPages(pages, cited);
    let attached = 0;
    let renderedNew = false;
    for (const pageNumber of captionPages) {
      if (attached >= MAX_SECTION_FIGURES) break;
      const existing = renderedPages.get(pageNumber);
      if (existing) {
        if (!section.figureIds.includes(existing)) {
          section.figureIds.push(existing);
          attached++;
        }
        continue;
      }
      if (renderedNew || renderedPages.size >= maxRenderedPages) break;
      const pageObj = pageObjects.get(pageNumber);
      if (!pageObj) continue;
      const encoded = await renderPage(pageObj, PAGE_RENDER_SCALE);
      if (!encoded) continue;
      renderedNew = true;
      const figureId = `fig-page-${pageNumber}`;
      renderedPages.set(pageNumber, figureId);
      figures.push({
        id: figureId,
        base64: encoded.base64,
        mimeType: 'image/jpeg',
        width: encoded.width,
        height: encoded.height,
        bytes: encoded.bytes,
      });
      section.figureIds.push(figureId);
      attached++;
    }
  }
  pdf.cleanup();

  const warnings = [...modelResult.warnings];
  if (truncatedText.truncated) warnings.push('Texto recortado a 60.000 caracteres.');
  if (figuresTruncated) warnings.push(`Se omitieron figuras por límite de memoria (máximo ${MAX_PDF_FIGURES}).`);
  const uncovered = modelResult.sections.filter(
    (s) =>
      findFigureCitations(s.text).length > 0 &&
      !(s.figureIds ?? []).some((id) => figures.some((f) => f.id === id))
  );
  if (uncovered.length > 0) {
    warnings.push('Alguna figura citada no se pudo visualizar como imagen.');
  }

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
