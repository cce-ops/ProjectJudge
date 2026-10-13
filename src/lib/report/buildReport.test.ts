import { describe, it, expect } from 'vitest';
import { buildReportBlocks, displayTitle, verdictsForCriterion, formatFigureNote, nonEvaluableLine } from './buildReport';
import type { ReportView } from '../../types/evaluation';

function sampleView(): ReportView {
  return {
    reportId: 'rep-1',
    createdAt: '2026-10-11T00:00:00.000Z',
    model: 'gemini-3.8-flash',
    rubric: {
      criteria: [
        {
          id: 'c1',
          name: 'Rigor tecnico',
          description: '',
          maxScore: 10,
          levels: [{ label: 'Bien', descriptor: '', score: 8 }],
        },
      ],
      scale: { min: 0, max: 10 },
      source: 'Manual',
      fingerprint: 'fp',
    },
    document: { fileName: 'informe.pdf', format: 'pdf', stats: { words: 100, figuresUsed: 1, figuresDiscarded: 0 } },
    map: {
      slots: [
        { slot: { id: 'objetivos', label: 'Objetivos', description: '' }, present: true, sectionId: 's1' },
        { slot: { id: 'planificacion', label: 'Planificación', description: '' }, present: false, sectionId: null },
      ],
      summary: 'Resumen del mapa.',
      titles: [
        { sectionId: 's1', title: 'Objetivos del estudio' },
        { sectionId: 's2', title: 'Anexo sin evaluar' },
      ],
    },
    sections: [
      {
        sectionId: 's1',
        title: 'Objetivos',
        slotId: 'objetivos',
        criteria: [
          { criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Cita literal', feedback: 'Bien.', evaluable: true },
        ],
        strengths: ['Claro'],
        improvements: ['Ampliar'],
        figureNotes: [{ figureId: 'fig-0', note: 'Figura 2: evolución horaria.' }],
        evaluated: true,
      },
      {
        sectionId: 's2',
        title: 'Anexo sin evaluar',
        slotId: null,
        criteria: [],
        strengths: [],
        improvements: [],
        figureNotes: [],
        evaluated: false,
        error: 'No evaluada: excede el límite de secciones.',
      },
    ],
    synthesis: {
      overallAssessment: 'Mejorable',
      summary: 'Resumen global.',
      strengths: ['S'],
      improvements: ['I'],
      coherenceNotes: ['Coherente.'],
      referenceComparison: 'Nivel medio.',
      about: 'Informe sobre una comunidad energética con tres escenarios.',
      nextSteps: ['Cuantificar el CAPEX.', 'Corregir la Tabla 2.'],
    },
    checks: [],
  };
}

describe('buildReportBlocks', () => {
  it('genera cabecera, apartados y sintesis sin nota global', () => {
    const blocks = buildReportBlocks(sampleView());
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].heading).toContain('informe.pdf');
    expect(blocks[0].paragraphs.join(' ')).toContain('Mejorable');
    const body = blocks.map((b) => `${b.heading} ${b.paragraphs.join(' ')}`).join('\n');
    expect(body).toContain('Objetivos');
    expect(body).toContain('No evaluada');
    expect(body).not.toMatch(/nota global/i);
    expect(body).not.toMatch(/puntuaci.n global/i);
  });

  it('incluye la ficha del informe con presentacion y estructura', () => {
    const blocks = buildReportBlocks(sampleView());
    const head = blocks[0].paragraphs.join(' ');
    expect(head).toContain('Manual');
    expect(head).toContain('gemini-3.8-flash');
    expect(head).toContain('comunidad energética');
    expect(head).toContain('Objetivos del estudio');
  });

  it('incluye el bloque para subir de nivel', () => {
    const blocks = buildReportBlocks(sampleView());
    const steps = blocks.find((b) => b.heading === 'Para subir de nivel');
    expect(steps?.paragraphs).toEqual(['Cuantificar el CAPEX.', 'Corregir la Tabla 2.']);
  });

  it('no incluye el bloque Criterios de evaluacion', () => {
    const blocks = buildReportBlocks(sampleView());
    const headings = blocks.map((b) => b.heading);
    expect(headings).not.toContain('Criterios de evaluación');
  });

  it('no incluye notas de figuras en los apartados', () => {
    const blocks = buildReportBlocks(sampleView());
    const body = blocks.map((b) => `${b.heading} ${b.paragraphs.join(' ')}`).join('\n');
    expect(body).not.toContain('Figura 2: evolución horaria');
  });

  it('colapsa los apartados no evaluados en un solo bloque', () => {
    const view = sampleView();
    const body = buildReportBlocks(view)
      .map((b) => `${b.heading} ${b.paragraphs.join(' ')}`)
      .join('\n');
    expect(body).toContain('Apartados no evaluados (1)');
    expect(body).toContain('Anexo sin evaluar');
  });

  it('incluye las comprobaciones en el informe', () => {
    const view = sampleView();
    view.checks = [{ id: 'decimales', passed: false, message: 'Se mezclan coma y punto.' }];
    const body = buildReportBlocks(view)
      .map((b) => `${b.heading} ${b.paragraphs.join(' ')}`)
      .join('\n');
    expect(body).toContain('Comprobaciones');
    expect(body).toContain('Se mezclan coma y punto.');
  });

  it('la ficha lista los evaluados y colapsa el resto', () => {
    const view = sampleView();
    const body = buildReportBlocks(view)
      .map((b) => `${b.heading} ${b.paragraphs.join(' ')}`)
      .join('\n');
    expect(body).toContain('Objetivos del estudio');
    expect(body).toContain('… y 1 apartado más sin evaluar.');
  });
});

describe('utilidades', () => {
  it('displayTitle prefiere el titulo del mapa', () => {
    const view = sampleView();
    expect(displayTitle(view, view.sections[0])).toBe('Objetivos del estudio');
    expect(displayTitle(view, { ...view.sections[0], sectionId: 'desconocida', title: '' })).toBe('desconocida');
  });

  it('verdictsForCriterion empareja por id o por nombre e indica el apartado', () => {
    const view = sampleView();
    const byId = verdictsForCriterion(view, view.rubric.criteria[0]);
    expect(byId).toHaveLength(1);
    expect(byId[0].sectionTitle).toBe('Objetivos del estudio');
    const renamed = { ...view, sections: view.sections.map((s) => ({ ...s })) };
    renamed.sections[0] = {
      ...renamed.sections[0],
      criteria: [{ ...renamed.sections[0].criteria[0], criterionId: 'Rigor tecnico' }],
    };
    expect(verdictsForCriterion(renamed, view.rubric.criteria[0])).toHaveLength(1);
  });

  it('formatFigureNote no duplica la palabra Figura', () => {
    expect(formatFigureNote('fig-0', 'Figura 2: evolución horaria.')).toBe('Figura 2: evolución horaria.');
    expect(formatFigureNote('fig-0', 'Muestra la demanda.')).toBe('Figura fig-0: Muestra la demanda.');
  });

  it('formatFigureNote sanea tartamudeos y tablas', () => {
    expect(formatFigureNote('fig-0', 'Figura Figura 1: localización.')).toBe('Figura 1: localización.');
    expect(formatFigureNote('fig-0', 'Figura Tabla 2: características.')).toBe('Tabla 2: características.');
    expect(formatFigureNote('fig-page-7', 'Se ve el estado de carga.')).toBe('Figura (pág. 7): Se ve el estado de carga.');
  });

  it('nonEvaluableLine usa singular y plural por apartados distintos', () => {
    expect(nonEvaluableLine(['Portada'])).toBe('No evaluable en otro apartado.');
    expect(nonEvaluableLine(['A', 'B', 'A'])).toBe('No evaluable en otros 2 apartados.');
  });
});
