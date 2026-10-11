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
    },
    sections: [
      {
        sectionId: 's1',
        title: 'Objetivos',
        slotId: 'objetivos',
        criteria: [{ criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Cita de evidencia', feedback: 'Bien planteados.' }],
        strengths: ['Claridad'],
        improvements: ['Cuantificar'],
        figureNotes: [],
        evaluated: true,
      },
    ],
    synthesis: {
      overallAssessment: 'Mejorable',
      summary: 'Resumen global.',
      strengths: ['S'],
      improvements: ['I'],
      coherenceNotes: ['Los objetivos y las conclusiones son coherentes.'],
      referenceComparison: 'Nivel medio.',
    },
  };
}

describe('ResultsPanel', () => {
  it('muestra la valoracion, los criterios con evidencia y los apartados', () => {
    render(<ResultsPanel view={sampleView()} onReset={vi.fn()} onDownloadWord={vi.fn()} />);
    expect(screen.getByText('Mejorable')).toBeInTheDocument();
    expect(screen.getByText(/Rigor tecnico/)).toBeInTheDocument();
    expect(screen.getByText(/8\/10/)).toBeInTheDocument();
    expect(screen.getByText(/Cita de evidencia/)).toBeInTheDocument();
    expect(screen.getByText(/Objetivos/)).toBeInTheDocument();
    expect(screen.getByText(/Claridad/)).toBeInTheDocument();
    expect(screen.getByText(/Cuantificar/)).toBeInTheDocument();
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
});
