import type { Section, FigureCandidate } from '../types/extract';

function getTextContent(el: Element | null): string {
  if (!el) return '';
  return Array.from(el.getElementsByTagName('t'))
    .map(t => t.textContent || '')
    .join('');
}

export function documentXmlToModel(
  xml: string,
  media: Record<string, unknown>
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
    const pPr = p.getElementsByTagName('w:pPr')?.[0] || p.getElementsByTagName('pPr')?.[0];
    const pStyle = pPr?.getElementsByTagName('w:pStyle')?.[0] || pPr?.getElementsByTagName('pStyle')?.[0];
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

  return { sections, figureCandidates, warnings };
}
