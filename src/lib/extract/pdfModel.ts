import type { Section, FigureCandidate } from '../../types/extract';

export interface PdfPageDump {
  pageNumber: number;
  lines: string[];
  images: { name: string; width: number; height: number; hash: string }[];
}

export function looksLikeHeading(line: string, keywords: string[]): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 90) return false;
  // Numerical heading
  if (/^\d+(\.\d+)*[.)]?\s+\S+/.test(trimmed)) return true;
  // All uppercase heading
  if (trimmed === trimmed.toUpperCase() && trimmed.length < 60) return true;
  // Keyword match
  const lowerLine = trimmed.toLowerCase();
  for (const kw of keywords) {
    if (lowerLine.includes(kw.toLowerCase())) return true;
  }
  return false;
}

export function pdfPagesToModel(
  pages: PdfPageDump[],
  keywords: string[]
): { sections: Section[]; figureCandidates: FigureCandidate[]; warnings: string[] } {
  const sections: Section[] = [];
  const figureCandidates: FigureCandidate[] = [];
  const warnings: string[] = [];

  let currentSection: Section | null = null;
  let hasText = false;

  for (const page of pages) {
    for (const line of page.lines) {
      if (!line.trim()) continue;
      hasText = true;
      if (looksLikeHeading(line, keywords)) {
        currentSection = {
          id: `sec-${sections.length}`,
          title: line.trim(),
          level: 1,
          text: '',
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          figureIds: [],
        };
        sections.push(currentSection);
      } else {
        if (currentSection) {
          currentSection.text += (currentSection.text ? ' ' : '') + line.trim();
          currentSection.pageEnd = page.pageNumber;
        } else {
          // Sin encabezado detectado, crear sección por defecto
          currentSection = {
            id: `sec-${sections.length}`,
            title: '',
            level: 1,
            text: line.trim(),
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            figureIds: [],
          };
          sections.push(currentSection);
        }
      }
    }
    for (const img of page.images) {
      figureCandidates.push({
        id: `fig-${figureCandidates.length}`,
        base64: '',
        mimeType: 'image/png',
        width: img.width,
        height: img.height,
        bytes: 0,
        hash: img.hash,
        sourcePage: page.pageNumber,
      });
    }
  }

  if (!hasText) {
    warnings.push('El PDF no tiene texto extraíble; parece un escaneado o una imagen.');
  }

  return { sections, figureCandidates, warnings };
}
