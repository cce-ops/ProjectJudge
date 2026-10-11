import { describe, it, expect, vi } from 'vitest';
import { evaluateSections, mergeTinySections, type SectionProgress } from './evaluateSections';
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
    const seen: SectionProgress[] = [];
    const rubric = { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    await evaluateSections(
      { document, references: [], rubric, onSectionProgress: (p) => seen.push(p) },
      mockClient
    );
    expect(seen.map((p) => p.done)).toEqual([1, 2, 3]);
    expect(seen.every((p) => p.total === 3)).toBe(true);
    expect(seen.map((p) => p.title)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('conserva las secciones diminutas con titulo y absorbe los fragmentos sin titulo', async () => {
    const mockClient = { generateJson: vi.fn().mockImplementation(async () => okResponse('s')) } as any;
    const tiny = 'texto diminuto';
    const document = docWithSections([
      { id: 's1', title: 'Grande', text: longText('grande') },
      { id: 's2', title: 'Diminuta', text: tiny },
      { id: 's3', title: '', text: 'Rótulo suelto sin título.' },
      { id: 's4', title: 'Otra', text: longText('otra') },
    ]);
    const rubric = { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any;
    const result = await evaluateSections({ document, references: [], rubric }, mockClient);
    expect(mockClient.generateJson).toHaveBeenCalledTimes(3);
    const prompts = mockClient.generateJson.mock.calls.map((c: any[]) => c[0].prompt as string);
    expect(prompts.some((p: string) => p.includes('Rótulo suelto sin título.'))).toBe(true);
    expect(result).toHaveLength(3);
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

  it('conserva las secciones diminutas que tienen titulo propio', () => {
    const sections = [
      { id: 'a', title: 'Introducción', level: 1, text: longText('a'), figureIds: [] as string[] },
      { id: 'b', title: 'Objetivos', level: 1, text: 'Texto corto con título.', figureIds: [] as string[] },
    ];
    const merged = mergeTinySections(sections);
    expect(merged).toHaveLength(2);
    expect(merged[1].title).toBe('Objetivos');
  });

  it('absorbe los fragmentos diminutos sin titulo en la seccion anterior', () => {
    const sections = [
      { id: 'a', title: 'Grande', level: 1, text: longText('a'), figureIds: [] as string[] },
      { id: 'b', title: '', level: 0, text: 'Rótulo suelto.', figureIds: [] as string[] },
    ];
    const merged = mergeTinySections(sections);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toContain('Rótulo suelto.');
  });

  it('normaliza al identificador canonico cuando la IA devuelve el nombre', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        criteria: [
          { criterionId: 'Rigor tecnico', score: 7, maxScore: 10, evidence: 'E', feedback: 'F', evaluable: true },
        ],
        strengths: [],
        improvements: [],
        figureNotes: [],
      }),
    } as any;
    const document = docWithSections([{ id: 's1', title: 'Unica', text: longText('texto') }]);
    const rubric = {
      criteria: [{ id: 'c1', name: 'Rigor tecnico', description: '', maxScore: 10, levels: [] }],
      scale: { min: 0, max: 10 },
      source: '',
      fingerprint: '',
    } as any;
    const result = await evaluateSections({ document, references: [], rubric }, mockClient);
    expect(result[0].criteria[0].criterionId).toBe('c1');
  });

  it('registra los criterios no evaluables con su motivo', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        criteria: [
          {
            criterionId: 'c-oral',
            score: 0,
            maxScore: 10,
            evidence: '',
            feedback: '',
            evaluable: false,
            motivo: 'Requiere la exposición oral, no aportada.',
          },
        ],
        strengths: [],
        improvements: [],
        figureNotes: [],
      }),
    } as any;
    const document = docWithSections([{ id: 's1', title: 'Unica', text: longText('texto') }]);
    const rubric = {
      criteria: [{ id: 'c-oral', name: 'Exposición', description: '', maxScore: 10, levels: [] }],
      scale: { min: 0, max: 10 },
      source: '',
      fingerprint: '',
    } as any;
    const result = await evaluateSections({ document, references: [], rubric }, mockClient);
    expect(result[0].criteria[0].evaluable).toBe(false);
    expect(result[0].criteria[0].motivo).toContain('exposición oral');
  });
});
