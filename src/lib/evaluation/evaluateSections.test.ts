import { describe, it, expect, vi } from 'vitest';
import { evaluateSections, mergeTinySections } from './evaluateSections';
import { createConcurrencyLimiter } from '../ai/limiter';
import type { ExtractedDocument } from '../../types/extract';

function longText(seed: string): string {
  return Array.from({ length: 80 }, () => `contenido ${seed}`).join(' ');
}

function docWithSections(titled: { id: string; title: string; text: string }[]): ExtractedDocument {
  return {
    fileName: 'x',
    format: 'md',
    text: 't',
    sections: titled.map((s) => ({ ...s, level: 1, figureIds: [] as string[] })),
    figures: [],
    warnings: [],
    stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
  };
}

function okResponse(sectionId: string) {
  return {
    criteria: [{ criterionId: 'c1', score: 8, maxScore: 10, evidence: 'E', feedback: 'F' }],
    strengths: [],
    improvements: [],
    figureNotes: [],
    sectionId,
  };
}

describe('evaluateSections', () => {
  it('evaluates each section against criteria', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        sections: [
          {
            sectionId: 's1',
            criteria: [{ criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Bueno', feedback: 'OK' }],
            strengths: ['Fuerte'],
            improvements: ['Mejorar'],
          },
        ],
      }),
    } as any;

    const document: ExtractedDocument = {
      fileName: 'x', format: 'md', text: 't',
      sections: [{ id: 's1', title: 'Test', level: 1, text: 'texto', figureIds: [] }],
      figures: [], warnings: [], stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
    };

    const result = await evaluateSections({ document, references: [], rubric: { criteria: [{ id: 'c1', name: 'Contenido', maxScore: 10, levels: [{ label: 'L', descriptor: '', score: 8 }] }], scale: { min: 0, max: 10 }, source: 'Manual', fingerprint: 'fp' } as any }, mockClient);
    expect(Array.isArray(result)).toBe(true);
  });

  it('preserves partial results when a section fails', async () => {
    const mockClient = {
      generateJson: vi.fn()
        .mockRejectedValueOnce(new Error('Fallo'))
        .mockResolvedValue({ sections: [{ sectionId: 's2', criteria: [], strengths: [], improvements: [] }] }),
    } as any;

    const document: ExtractedDocument = {
      fileName: 'x', format: 'md', text: 't',
      sections: [
        { id: 's1', title: 'S1', level: 1, text: 'a', figureIds: [] },
        { id: 's2', title: 'S2', level: 1, text: 'b', figureIds: [] },
      ],
      figures: [], warnings: [], stats: { words: 2, figuresUsed: 0, figuresDiscarded: 0 },
    };

    const result = await evaluateSections({ document, references: [], rubric: { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any }, mockClient);
    expect(result.some((r: any) => !r.evaluated)).toBe(true);
  });

  it('informa del progreso de cada seccion evaluada', async () => {
    const mockClient = {
      generateJson: vi.fn().mockImplementation(async () => okResponse('s')),
    } as any;
    const document = docWithSections([
      { id: 's1', title: 'Uno', text: longText('uno') },
      { id: 's2', title: 'Dos', text: longText('dos') },
      { id: 's3', title: 'Tres', text: longText('tres') },
    ]);
    const seen: { done: number; total: number; title: string }[] = [];
    const rubric = { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    await evaluateSections(
      { document, references: [], rubric, onSectionProgress: (p) => seen.push(p) },
      mockClient
    );
    expect(seen.map((p) => p.done)).toEqual([1, 2, 3]);
    expect(seen.every((p) => p.total === 3)).toBe(true);
    expect(seen.map((p) => p.title)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('fusiona las secciones diminutas con la anterior y conserva su texto', async () => {
    const mockClient = { generateJson: vi.fn().mockImplementation(async () => okResponse('s')) } as any;
    const tiny = 'texto diminuto';
    const document = docWithSections([
      { id: 's1', title: 'Grande', text: longText('grande') },
      { id: 's2', title: 'Diminuta', text: tiny },
      { id: 's3', title: 'Otra', text: longText('otra') },
    ]);
    const rubric = { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    const result = await evaluateSections({ document, references: [], rubric }, mockClient);
    expect(mockClient.generateJson).toHaveBeenCalledTimes(2);
    const firstPrompt = mockClient.generateJson.mock.calls[0][0].prompt as string;
    expect(firstPrompt).toContain(tiny);
    expect(result).toHaveLength(2);
  });

  it('envia todos los criterios de la rubrica, no solo los cuatro primeros', async () => {
    const criteria = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      name: `Criterio${i}`,
      maxScore: 10,
      levels: [],
    }));
    const prompts: string[] = [];
    const mockClient = {
      generateJson: vi.fn().mockImplementation(async ({ prompt }: any) => {
        prompts.push(prompt);
        return okResponse('s');
      }),
    } as any;
    const document = docWithSections([{ id: 's1', title: 'Unica', text: longText('texto') }]);
    const rubric = { criteria, scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    await evaluateSections({ document, references: [], rubric }, mockClient);
    for (const c of criteria) {
      expect(prompts[0]).toContain(c.name);
    }
  });

  it('mantiene el orden con evaluacion en paralelo aunque terminen desordenadas', async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    const mockClient = {
      generateJson: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          })
      ),
    } as any;
    const document = docWithSections([
      { id: 's1', title: 'Primera', text: longText('a') },
      { id: 's2', title: 'Segunda', text: longText('b') },
      { id: 's3', title: 'Tercera', text: longText('c') },
    ]);
    const rubric = { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    const pending = evaluateSections(
      { document, references: [], rubric },
      mockClient,
      createConcurrencyLimiter(2)
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(resolvers.length).toBe(2);
    resolvers[1](okResponse('s2'));
    await new Promise((r) => setTimeout(r, 10));
    expect(resolvers.length).toBe(3);
    resolvers[2](okResponse('s3'));
    resolvers[0](okResponse('s1'));
    const result = await pending;
    expect(result.map((r) => r.sectionId)).toEqual(['s1', 's2', 's3']);
  });

  it('interrumpe tras tres fallos consecutivos sin quemar mas llamadas', async () => {
    const mockClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('429 cuota agotada')),
    } as any;
    const document = docWithSections(
      Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: `S${i}`, text: longText(`t${i}`) }))
    );
    const rubric = { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    const result = await evaluateSections({ document, references: [], rubric }, mockClient);
    expect(mockClient.generateJson).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(5);
    expect(result[3].evaluated).toBe(false);
    expect(result[3].error).toMatch(/cuota|repetidamente|interrumpida/i);
  });

  it('mergeTinySections deja intactas las secciones con contenido suficiente', () => {
    const sections = [
      { id: 'a', title: 'A', level: 1, text: longText('a'), figureIds: [] as string[] },
      { id: 'b', title: 'B', level: 1, text: longText('b'), figureIds: [] as string[] },
    ];
    expect(mergeTinySections(sections)).toHaveLength(2);
  });
});
