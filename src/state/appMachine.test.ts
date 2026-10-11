import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from './appMachine';
import type { RubricModel } from '../types/rubric';
import type { ExtractedDocument } from '../types/extract';

function sampleRubric(): RubricModel {
  return {
    criteria: [],
    scale: { min: 0, max: 10 },
    source: 'Manual',
    fingerprint: 'fp',
  };
}

function sampleDocument(): ExtractedDocument {
  return {
    fileName: 'informe.pdf',
    format: 'pdf',
    text: 'texto',
    sections: [],
    figures: [],
    warnings: [],
    stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
  };
}

describe('appReducer', () => {
  it('rubric/parsed fija la rubrica y avanza a documents', () => {
    const state = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    expect(state.rubric).not.toBeNull();
    expect(state.step).toBe('documents');
  });

  it('documents/extracted guarda el documento y pasa a mapping', () => {
    const s1 = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    const s2 = appReducer(s1, { type: 'documents/extracted', document: sampleDocument() });
    expect(s2.document?.fileName).toBe('informe.pdf');
    expect(s2.step).toBe('mapping');
  });

  it('evaluation/progress actualiza el progreso', () => {
    const s1 = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    const s2 = appReducer(s1, {
      type: 'evaluation/progress',
      progress: { phase: 'sections', sectionIndex: 2, sectionTotal: 5, sectionTitle: 'Objetivos' },
    });
    expect(s2.progress?.sectionIndex).toBe(2);
    expect(s2.progress?.sectionTitle).toBe('Objetivos');
  });

  it('evaluation/done fija el informe y pasa a results', () => {
    const s1 = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    const report = { reportId: 'rep-1' } as never;
    const s2 = appReducer(s1, { type: 'evaluation/done', report });
    expect(s2.report?.reportId).toBe('rep-1');
    expect(s2.step).toBe('results');
  });

  it('evaluation/failed fija el error y vuelve a documents', () => {
    const s1 = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    const s2 = appReducer(s1, { type: 'evaluation/failed', error: 'Fallo la IA' });
    expect(s2.error).toBe('Fallo la IA');
    expect(s2.step).toBe('documents');
  });

  it('evaluation/reset limpia documento e informe', () => {
    const s1 = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    const s2 = appReducer(s1, { type: 'documents/extracted', document: sampleDocument() });
    const s3 = appReducer(s2, { type: 'evaluation/reset' });
    expect(s3.document).toBeNull();
    expect(s3.report).toBeNull();
    expect(s3.step).toBe('documents');
  });

  it('documents/submitted sin API key produce el error de clave', () => {
    const s = appReducer(initialState(), { type: 'documents/submitted' });
    expect(s.error).toContain('Introduce tu API key de Gemini');
  });

  it('rubric/failed fija el error y se queda en rubric', () => {
    const s = appReducer(initialState(), { type: 'rubric/failed', error: 'No se pudo interpretar la rúbrica' });
    expect(s.error).toContain('rúbrica');
    expect(s.step).toBe('rubric');
  });

  it('references/added guarda hasta 2 referencias e ignora la tercera', () => {
    const ref = (id: string) => ({
      fileName: `${id}.pdf`,
      format: 'pdf',
      text: 'texto',
      stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
    });
    const s1 = appReducer(initialState(), { type: 'references/added', reference: ref('a') });
    const s2 = appReducer(s1, { type: 'references/added', reference: ref('b') });
    const s3 = appReducer(s2, { type: 'references/added', reference: ref('c') });
    expect(s3.references.map((r) => r.fileName)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('references/removed borra una referencia', () => {
    const ref = (fileName: string) => ({
      fileName,
      format: 'pdf',
      text: 'texto',
      stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
    });
    const s1 = appReducer(initialState(), { type: 'references/added', reference: ref('a.pdf') });
    const s2 = appReducer(s1, { type: 'references/removed', fileName: 'a.pdf' });
    expect(s2.references).toEqual([]);
  });

  it('notice/shown fija un aviso sin cambiar de paso', () => {
    const s1 = appReducer(initialState(), { type: 'rubric/parsed', rubric: sampleRubric() });
    const s2 = appReducer(
      { ...s1, step: 'results' as const },
      { type: 'notice/shown', error: 'No se pudo generar el Word.' }
    );
    expect(s2.error).toBe('No se pudo generar el Word.');
    expect(s2.step).toBe('results');
  });
});
