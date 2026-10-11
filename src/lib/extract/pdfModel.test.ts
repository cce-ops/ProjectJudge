import { describe, it, expect } from 'vitest';
import { pdfPagesToModel, looksLikeHeading } from './pdfModel';

const mockPages = [
  {
    pageNumber: 1,
    lines: ['1. Antecedentes y contexto', 'Este proyecto surge de la necesidad...'],
    images: [
      { name: 'image1.png', width: 200, height: 200, hash: 'hash1', base64: 'AAA', bytes: 40000, mimeType: 'image/jpeg' },
    ],
  },
  {
    pageNumber: 2,
    lines: ['2. METODOLOGÍA', 'El enfoque es cuantitativo...'],
    images: [
      { name: 'image2.png', width: 100, height: 100, hash: 'hash2', base64: 'BBB', bytes: 40000, mimeType: 'image/jpeg' },
    ],
  },
];

describe('pdfPagesToModel', () => {
  it('detects sections from headings', () => {
    const { sections } = pdfPagesToModel(mockPages, []);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toContain('Antecedentes');
    expect(sections[1].title).toContain('METODOLOGÍA');
  });

  it('handles pages without text', () => {
    const result = pdfPagesToModel([{ pageNumber: 1, lines: [], images: [] }], []);
    expect(result.warnings.some(w => w.includes('texto'))).toBe(true);
  });

  it('produces figure candidates', () => {
    const { figureCandidates } = pdfPagesToModel(mockPages, []);
    expect(figureCandidates.length).toBe(2);
  });

  it('asigna a cada seccion las figuras de sus paginas', () => {
    const { sections } = pdfPagesToModel(mockPages, []);
    expect(sections[0].figureIds).toEqual(['fig-0']);
    expect(sections[1].figureIds).toEqual(['fig-1']);
  });

  it('propaga el contenido real de las imagenes a las candidatas', () => {
    const { figureCandidates } = pdfPagesToModel(mockPages, []);
    expect(figureCandidates[0].base64).toBe('AAA');
    expect(figureCandidates[0].mimeType).toBe('image/jpeg');
  });
});

describe('looksLikeHeading', () => {
  it('identifies numbered headings', () => {
    expect(looksLikeHeading('3. Objetivos específicos', [])).toBe(true);
  });

  it('identifies uppercase headings', () => {
    expect(looksLikeHeading('PRESUPUESTO', [])).toBe(true);
  });

  it('matches keywords', () => {
    expect(looksLikeHeading('Planificación temporal', ['planificación', 'cronograma'])).toBe(true);
  });

  it('rejects normal text', () => {
    expect(looksLikeHeading('Este es un párrafo normal.', [])).toBe(false);
  });
});
