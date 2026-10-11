import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { DEFAULT_SETTINGS } from '../lib/storage/settings';

describe('Sidebar', () => {
  const rubricProps = { onRubricDraft: vi.fn() };

  it('muestra Configurada cuando hay clave y el nombre de la rubrica activa', () => {
    render(
      <Sidebar
        settings={{ ...DEFAULT_SETTINGS, apiKey: 'clave-123' }}
        onSaveKey={vi.fn()}
        onRemoveKey={vi.fn()}
        onModelChange={vi.fn()}
        onThemeToggle={vi.fn()}
        rubricName="Rubrica de Proyectos 2026"
        referenceCount={1}
        {...rubricProps}
      />
    );
    expect(screen.getByText('Configurada')).toBeInTheDocument();
    expect(screen.getByText(/Rubrica de Proyectos 2026/)).toBeInTheDocument();
  });

  it('pide la clave cuando no hay ninguna guardada', () => {
    render(
      <Sidebar
        settings={DEFAULT_SETTINGS}
        onSaveKey={vi.fn()}
        onRemoveKey={vi.fn()}
        onModelChange={vi.fn()}
        onThemeToggle={vi.fn()}
        rubricName={null}
        referenceCount={0}
        {...rubricProps}
      />
    );
    expect(screen.getByPlaceholderText(/AIza/)).toBeInTheDocument();
  });

  it('envia el texto de rubrica pegado como borrador', () => {
    const onRubricDraft = vi.fn();
    render(
      <Sidebar
        settings={DEFAULT_SETTINGS}
        onSaveKey={vi.fn()}
        onRemoveKey={vi.fn()}
        onModelChange={vi.fn()}
        onThemeToggle={vi.fn()}
        rubricName={null}
        referenceCount={0}
        onRubricDraft={onRubricDraft}
      />
    );
    fireEvent.change(screen.getByLabelText(/pegar rúbrica/i), {
      target: { value: 'Criterio: rigor, 10 puntos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /usar texto pegado/i }));
    expect(onRubricDraft).toHaveBeenCalledWith('Criterio: rigor, 10 puntos.');
    expect(screen.getByRole('status')).toHaveTextContent(/27 caracteres/);
  });

  it('extrae el texto de un archivo de rubrica adjunto', async () => {
    const onRubricDraft = vi.fn();
    render(
      <Sidebar
        settings={DEFAULT_SETTINGS}
        onSaveKey={vi.fn()}
        onRemoveKey={vi.fn()}
        onModelChange={vi.fn()}
        onThemeToggle={vi.fn()}
        rubricName={null}
        referenceCount={0}
        onRubricDraft={onRubricDraft}
      />
    );
    const input = screen.getByLabelText(/adjuntar rúbrica/i) as HTMLInputElement;
    const file = { name: 'rubrica.md', text: async () => '# Rigor tecnico' } as unknown as File;
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText(/rubrica\.md.*lista/i);
    expect(onRubricDraft).toHaveBeenCalledWith('# Rigor tecnico');
  });
});
