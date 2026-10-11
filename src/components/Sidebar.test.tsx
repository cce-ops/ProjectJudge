import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { DEFAULT_SETTINGS } from '../lib/storage/settings';

describe('Sidebar', () => {
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
      />
    );
    expect(screen.getByPlaceholderText(/AIza/)).toBeInTheDocument();
  });
});
