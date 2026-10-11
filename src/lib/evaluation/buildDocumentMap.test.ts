import { describe, it, expect, vi } from 'vitest';
import { buildDocumentMap } from './buildDocumentMap';
import type { ExtractedDocument } from '../types/extract';

function mockClient(response: any) {
  return {
    generateJson: vi.fn().mockResolvedValue(response),
  } as any;
}

describe('buildDocumentMap', () => {
  it('maps sections to engineering slots', async () => {
    const doc: ExtractedDocument = {
      fileName: 'informe.pdf', format: 'pdf', text: 'texto',
      sections: [
        { id: 's1', title: 'Antecedentes y contexto', level: 1, text: '...', figureIds: [] },
        { id: 's2', title: 'Objetivos del proyecto', level: 1, text: '...', figureIds: [] },
      ],
      figures: [], warnings: [], stats: { words: 10, figuresUsed: 0, figuresDiscarded: 0 },
    };
    const result = await buildDocumentMap(doc, mockClient({
      slots: [
        { slotId: 'antecedentes', present: true, sectionId: 's1' },
        { slotId: 'objetivos', present: true, sectionId: 's2' },
      ],
      summary: 'Resumen.',
    }));
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('marks missing slots', async () => {
    const doc: ExtractedDocument = {
      fileName: 'x', format: 'md', text: '',
      sections: [{ id: 's1', title: 'Antecedentes', level: 1, text: '', figureIds: [] }],
      figures: [], warnings: [], stats: { words: 0, figuresUsed: 0, figuresDiscarded: 0 },
    };
    const result = await buildDocumentMap(doc, mockClient({
      slots: [
        { slotId: 'antecedentes', present: true, sectionId: 's1' },
        { slotId: 'planificacion', present: false, sectionId: null },
      ],
      summary: 'Resumen.',
    }));
    const planSlot = result.slots.find(s => s.slot.id === 'planificacion');
    expect(planSlot?.present).toBe(false);
  });
});
