import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentsPanel } from './DocumentsPanel';

describe('DocumentsPanel', () => {
  it('muestra el resumen de extraccion y la estimacion', () => {
    render(
      <DocumentsPanel
        onSelectFile={vi.fn()}
        summary={{ sections: 4, figures: 2, words: 1200, warnings: ['Aviso de prueba'] }}
        estimate={{ calls: 6, tokens: 15000 }}
        referenceCount={1}
      />
    );
    expect(screen.getByText(/4 secciones/)).toBeInTheDocument();
    expect(screen.getByText(/2 figuras/)).toBeInTheDocument();
    expect(screen.getByText(/1200 palabras/)).toBeInTheDocument();
    expect(screen.getByText(/6 llamadas/)).toBeInTheDocument();
    expect(screen.getByText(/15000 tokens/)).toBeInTheDocument();
    expect(screen.getByText(/Aviso de prueba/)).toBeInTheDocument();
  });

  it('avisa de que se evaluara solo con la rubrica cuando no hay referencias', () => {
    render(
      <DocumentsPanel onSelectFile={vi.fn()} summary={null} estimate={null} referenceCount={0} />
    );
    expect(screen.getByText(/solo con la rúbrica/i)).toBeInTheDocument();
  });

  it('llama a onSelectFile al elegir un archivo', () => {    const onSelectFile = vi.fn();
    render(
      <DocumentsPanel onSelectFile={onSelectFile} summary={null} estimate={null} referenceCount={0} />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['contenido'], 'informe.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect((onSelectFile.mock.calls[0][0] as File).name).toBe('informe.pdf');
  });

  it('ofrece evaluar cuando ya hay un resumen y muestra las referencias', () => {
    const onEvaluate = vi.fn();
    const onAddReference = vi.fn();
    const onRemoveReference = vi.fn();
    render(
      <DocumentsPanel
        onSelectFile={vi.fn()}
        summary={{ sections: 2, figures: 0, words: 500, warnings: [] }}
        estimate={{ calls: 4, tokens: 8000 }}
        referenceCount={1}
        references={[{ fileName: 'ejemplo-2024.pdf' }]}
        onEvaluate={onEvaluate}
        onAddReference={onAddReference}
        onRemoveReference={onRemoveReference}
      />
    );
    expect(screen.getByText(/ejemplo-2024\.pdf/)).toBeInTheDocument();
    const evaluate = screen.getByRole('button', { name: /evaluar informe/i });
    fireEvent.click(evaluate);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
    const refInput = screen.getByLabelText(/añadir informe de referencia/i) as HTMLInputElement;
    const file = new File(['ref'], 'ref.pdf', { type: 'application/pdf' });
    fireEvent.change(refInput, { target: { files: [file] } });
    expect(onAddReference).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /quitar ejemplo-2024\.pdf/i }));
    expect(onRemoveReference).toHaveBeenCalledWith('ejemplo-2024.pdf');
  });
});
