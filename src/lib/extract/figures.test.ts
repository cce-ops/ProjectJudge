import { describe, it, expect, vi } from 'vitest';
import { selectFigures, reencodeFigure } from './figures';
import type { FigureCandidate, Figure } from '../../types/extract';

describe('selectFigures', () => {
  const mockCandidates: FigureCandidate[] = [
    { id: '1', base64: 'a', mimeType: 'image/png', width: 200, height: 200, bytes: 50000, hash: 'h1' },
    { id: '2', base64: 'b', mimeType: 'image/png', width: 50, height: 50, bytes: 50000, hash: 'h2' }, // Too small area
    { id: '3', base64: 'c', mimeType: 'image/png', width: 200, height: 200, bytes: 1000, hash: 'h3' }, // Too small bytes
    { id: '4', base64: 'a', mimeType: 'image/png', width: 200, height: 200, bytes: 50000, hash: 'h1' }, // Duplicate h1
    { id: '5', base64: 'd', mimeType: 'image/png', width: 300, height: 300, bytes: 50000, hash: 'h4' },
  ];

  it('filters figures by area, side and bytes', () => {
    const { figures, discarded } = selectFigures(mockCandidates);
    // Only id 1 and 5 should pass
    expect(figures.map(f => f.id)).toEqual(['fig-0', 'fig-1']);
    expect(discarded).toBe(3);
  });

  it('deduplicates figures by hash', () => {
    const { figures } = selectFigures(mockCandidates);
    // id 4 is duplicate of 1
    expect(figures.length).toBe(2);
  });

  it('respects maxFigures limit', () => {
    const { figures } = selectFigures(mockCandidates, { maxFigures: 1 });
    expect(figures.length).toBe(1);
    expect(figures[0].id).toBe('fig-0');
  });
});

describe('reencodeFigure', () => {
  it('resizes image to maxEdge and recodes to jpeg', async () => {
    const candidate: FigureCandidate = {
      id: '1', base64: 'a', mimeType: 'image/png', width: 2000, height: 1000, bytes: 100000, hash: 'h1'
    };
    
    const mockCanvasFactory = (w: number, h: number) => ({
      canvas: { width: w, height: h, toDataURL: () => 'data:image/jpeg;base64,encoded' } as any,
      ctx: {} as any,
    });

    const result = await reencodeFigure(candidate, 1024, mockCanvasFactory);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBe(1024);
    expect(result.height).toBe(512);
  });
});
