import { describe, it, expect, vi } from 'vitest';
import { synthesize } from './synthesize';

describe('synthesize', () => {
  it('returns qualitative assessment without global numeric score', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        overallAssessment: 'Mejorable',
        summary: 'El informe tiene estructura clara pero falta profundidad técnica.',
        strengths: ['Organización clara.'],
        improvements: ['Aumentar referencias.'],
        coherenceNotes: ['Los objetivos y conclusiones coinciden.'],
        referenceComparison: 'Nivel similar al ejemplo de referencia.',
      }),
    } as any;

    const result = await synthesize({
      map: { slots: [{ slot: { id: 'x', label: 'X', description: '' }, present: true, sectionId: 's1' }], summary: 'Resumen.' } as any,
      sections: [{ sectionId: 's1', title: 'Antecedentes', slotId: 'x', criteria: [], strengths: [], improvements: [], figureNotes: [], evaluated: true }] as any,
      rubric: { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any,
      referenceLabels: ['Referencia alta'],
    }, mockClient);

    expect(result.overallAssessment).toBe('Mejorable');
    expect(result.summary).toContain('estructura');
    // Confirmación clave de la spec: NO hay nota numérica global
    const hasNumericScore = typeof (result as any).score === 'number' || typeof (result as any).numericScore === 'number';
    expect(hasNumericScore).toBe(false);
  });

  it('rejects invalid overallAssessment values', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        overallAssessment: 'Aprobado', // No permitido
        summary: 'Resumen.',
        strengths: [],
        improvements: [],
        coherenceNotes: [],
        referenceComparison: '',
      }),
    } as any;

    await expect(
      synthesize({
        map: { slots: [], summary: '' } as any,
        sections: [] as any,
        rubric: { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any,
        referenceLabels: [],
      }, mockClient)
    ).rejects.toThrow();
  });

  it('fails gracefully when no sections have been evaluated', async () => {
    const mockClient = { generateJson: vi.fn() } as any;
    await expect(
      synthesize({
        map: { slots: [], summary: '' } as any,
        sections: [] as any,
        rubric: { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any,
        referenceLabels: [],
      }, mockClient)
    ).rejects.toThrow('No hay secciones evaluadas');
  });

  it('devuelve la presentacion del informe y los proximos pasos recortados a tres', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        overallAssessment: 'Correcto',
        summary: 'Resumen.',
        strengths: [],
        improvements: [],
        coherenceNotes: [],
        referenceComparison: '',
        about: 'Informe sobre una comunidad energética en Rubí con tres escenarios.',
        nextSteps: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4 sobrante'],
      }),
    } as any;

    const result = await synthesize({
      map: { slots: [], summary: '', titles: [] } as any,
      sections: [{ sectionId: 's1', title: 'A', slotId: null, criteria: [], strengths: [], improvements: [], figureNotes: [], evaluated: true }] as any,
      rubric: { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any,
      referenceLabels: [],
    }, mockClient);

    expect(result.about).toContain('comunidad energética');
    expect(result.nextSteps).toEqual(['Paso 1', 'Paso 2', 'Paso 3']);
  });
});
