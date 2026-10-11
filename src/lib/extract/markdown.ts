import { marked } from 'marked';
import type { Section, Figure } from '../types/extract';

export function markdownToModel(markdown: string): { sections: Section[]; figures: Figure[]; warnings: string[] } {
  const tokens = marked.lexer(markdown);
  const sections: Section[] = [];
  const figures: Figure[] = [];
  const warnings: string[] = [];

  let currentSection: Section | null = null;

  for (const token of tokens) {
    if (token.type === 'heading') {
      currentSection = {
        id: `sec-${sections.length}`,
        title: token.text,
        level: (token as any).depth ?? 1,
        text: '',
        figureIds: [],
      };
      sections.push(currentSection);
    } else if (token.type === 'paragraph' && currentSection) {
      currentSection.text += (currentSection.text ? '\n' : '') + token.text;
    } else if ((token as any).type === 'image' || ((token as any).raw && (token as any).raw.includes('!['))) {
      warnings.push('Las imágenes externas por URL no se incluyen en la evaluación.');
    }
  }

  // Si no hay encabezados, crear una sección por defecto
  if (sections.length === 0 && tokens.some(t => t.type === 'paragraph')) {
    const text = tokens.filter(t => t.type === 'paragraph').map(t => (t as any).text).join('\n');
    sections.push({ id: 'sec-0', title: '', level: 0, text, figureIds: [] });
    warnings.push('El documento no contiene encabezados; se ha tratado como una única sección.');
  }

  return { sections, figures, warnings };
}