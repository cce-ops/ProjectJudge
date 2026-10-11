import { describe, it, expect } from 'vitest';
import { markdownToModel } from './markdown';

describe('markdownToModel', () => {
  it('extracts sections from standard markdown', () => {
    const md = '# Introducción\nEste es el texto de intro.\n## Metodología\nPasos a seguir.';
    const { sections } = markdownToModel(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ title: 'Introducción', level: 1, text: 'Este es el texto de intro.' });
    expect(sections[1]).toMatchObject({ title: 'Metodología', level: 2, text: 'Pasos a seguir.' });
  });

  it('handles markdown without headings', () => {
    const md = 'Texto sin encabezados.';
    const { sections, warnings } = markdownToModel(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('');
    expect(warnings).toContain('El documento no contiene encabezados; se ha tratado como una única sección.');
  });

  it('warns about external images', () => {
    const md = '# Título\n![Imagen](http://externa.com/img.png)';
    const { warnings } = markdownToModel(md);
    expect(warnings).toContain('Las imágenes externas por URL no se incluyen en la evaluación.');
  });
});
