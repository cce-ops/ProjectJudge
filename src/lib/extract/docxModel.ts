import type { Section, FigureCandidate } from '../../types/extract';

export interface DocxMedia {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
}

export function documentXmlToModel(
  xml: string,
  media: Record<string, DocxMedia>
): { sections: Section[]; figureCandidates: FigureCandidate[]; warnings: string[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const sections: Section[] = [];
  const figureCandidates: FigureCandidate[] = [];
  const warnings: string[] = [];

  const paragraphs = doc.getElementsByTagName('w:p');
  let currentSection: Section | null = null;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    // El estilo de párrafo vive en w:pPr en documentos reales, pero se busca
    // en todo el párrafo para tolerar XML atípicos.
    const pStyle = p.getElementsByTagName('w:pStyle')?.[0] || p.getElementsByTagName('pStyle')?.[0];
    const val = (pStyle?.getAttribute('w:val') || pStyle?.getAttribute('val')) || '';
    const isHeading = val.toLowerCase().startsWith('heading');

    const textContent = Array.from(p.getElementsByTagName('w:t'))
      .map((t: any) => t.textContent || '')
      .join('');

    if (isHeading) {
      const headingLevel = parseInt(val.replace(/Heading/i, '')) || 1;
      currentSection = {
        id: `sec-${sections.length}`,
        title: textContent.trim(),
        level: headingLevel,
        text: '',
        pageStart: 0,
        pageEnd: 0,
        figureIds: [],
      };
      sections.push(currentSection);
    } else {
      if (!currentSection) {
        currentSection = {
          id: 'sec-0',
          title: '',
          level: 0,
          text: textContent.trim(),
          pageStart: 0,
          pageEnd: 0,
          figureIds: [],
        };
        sections.push(currentSection);
        warnings.push('El documento no contiene encabezados; se ha tratado como una única sección.');
      } else {
        currentSection.text += (currentSection.text ? '\n' : '') + textContent.trim();
      }
    }
  }

  if (sections.length === 0 && paragraphs.length > 0) {
    sections.push({
      id: 'sec-0', title: '', level: 0, text: '', pageStart: 0, pageEnd: 0, figureIds: [],
    });
    warnings.push('El documento no contiene encabezados; se ha tratado como una única sección.');
  }

  for (const [name, info] of Object.entries(media ?? {})) {
    figureCandidates.push({
      id: `fig-${figureCandidates.length}`,
      base64: info.base64,
      mimeType: info.mimeType,
      width: info.width,
      height: info.height,
      bytes: info.bytes,
      hash: info.hash || name,
    });
  }

  return { sections, figureCandidates, warnings };
}
