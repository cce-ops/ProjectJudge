import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsPanel } from './ResultsPanel';
import type { ReportView } from '../types/evaluation';

function sampleView(): ReportView {
  return {
    reportId: 'rep-1',
    createdAt: '2026-10-11T00:00:00.000Z',
    model: 'mi-modelo',
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
    document: { fileName: 'informe.pdf', format: 'pdf', stats: { words: 100, figuresUsed: 0, figuresDiscarded: 0 } },
    map: {
      slots: [
        { slot: { id: 'planificacion', label: 'Planificación', description: '' }, present: false, sectionId: null },
      ],
      summary: 'Resumen del mapa.',
      titles: [{ sectionId: 's1', title: 'Objetivos del estudio' }],
    },
    sections: [
      {
        sectionId: 's1',
        title: 'Objetivos',
        slotId: 'objetivos',
        criteria: [
          {
            criterionId: 'c1',
            score: 8,
            maxScore: 10,
            evidence: 'Cita de evidencia',
            feedback: 'Bien planteados.',
            evaluable: true,
          },
        ],
        strengths: ['Claridad'],
        improvements: ['Cuantificar'],
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
      coherenceNotes: ['Los objetivos y las conclusiones son coherentes.'],
      referenceComparison: 'Nivel medio.',
      about: 'Informe sobre una comunidad energética con tres escenarios.',
      nextSteps: ['Cuantificar el CAPEX.'],
    },
    checks: [
      { id: 'figuras-citadas', passed: true, message: 'Figuras citadas: 2. Imágenes detectadas: 1.' },
      { id: 'decimales', passed: false, message: 'Se mezclan coma y punto.' },
    ],
  };
}

describe('ResultsPanel', () => {
  it('muestra la valoracion y los apartados', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.getByText('Mejorable')).toBeInTheDocument();
    expect(screen.getAllByText(/Objetivos/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Claridad/)).toBeInTheDocument();
    expect(screen.getAllByText(/Cuantificar/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Planificación/)).toBeInTheDocument();
    expect(screen.getByText(/coherentes/)).toBeInTheDocument();
  });

  it('ofrece descargar, imprimir y evaluar otro informe', () => {
    const onReset = vi.fn();
    const onDownloadWord = vi.fn();
    render(<ResultsPanel view={sampleView()} onReset={onReset} onDownloadWord={onDownloadWord} />);
    fireEvent.click(screen.getByRole('button', { name: /descargar word/i }));
    expect(onDownloadWord).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /evaluar otro/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('no muestra ninguna nota global', () => {
    const { container } = render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(container.textContent).not.toMatch(/nota global/i);
    expect(container.textContent).not.toMatch(/puntuaci.n global/i);
  });

  it('muestra la ficha con presentacion, estructura y proximos pasos', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.getByText(/Ficha del informe/)).toBeInTheDocument();
    expect(screen.getByText(/comunidad energética/)).toBeInTheDocument();
    expect(screen.getAllByText(/Objetivos del estudio/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Para subir de nivel/)).toBeInTheDocument();
    expect(screen.getByText(/Cuantificar el CAPEX/)).toBeInTheDocument();
  });

  it('no muestra notas de figuras en los apartados', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.queryByText(/Figura 2: evolución horaria/)).not.toBeInTheDocument();
  });

  it('colapsa los apartados no evaluados en un desplegable', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.getByText(/Apartados no evaluados \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Anexo sin evaluar/).length).toBeGreaterThan(0);
  });

  it('la ficha colapsa los apartados sin evaluar', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.getByText(/… y 1 apartado más sin evaluar\./)).toBeInTheDocument();
  });

  it('muestra las comprobaciones mecanicas', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Comprobaciones' })).toBeInTheDocument();
    expect(screen.getByText(/Se mezclan coma y punto/)).toBeInTheDocument();
  });

  it('no muestra el bloque Criterios de evaluacion', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.queryByText(/Criterios de evaluación/)).not.toBeInTheDocument();
  });
});
