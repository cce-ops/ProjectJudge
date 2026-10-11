import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RubricPanel } from './RubricPanel';
import type { JsonClient } from '../lib/ai/gemini';

function stubClient(): JsonClient {
  return {
    generateJson: vi.fn().mockResolvedValue({
      criteria: [
        {
          id: 'c1',
          name: 'Rigor tecnico',
          description: 'Solidez del contenido',
          maxScore: 10,
          levels: [{ label: 'Bien', descriptor: 'Correcto', score: 8 }],
        },
      ],
      scale: { min: 0, max: 10 },
      source: 'Manual',
    }),
  } as unknown as JsonClient;
}

describe('RubricPanel', () => {
  it('pide la API key cuando no hay cliente', () => {
    render(<RubricPanel client={null} onConfirmed={vi.fn()} />);
    expect(screen.getByText(/Introduce tu API key/i)).toBeInTheDocument();
    const interpret = screen.getByRole('button', { name: /interpretar rúbrica/i }) as HTMLButtonElement;
    expect(interpret.disabled).toBe(true);
  });

  it('muestra los criterios devueltos al interpretar la rubrica', async () => {
    render(<RubricPanel client={stubClient()} onConfirmed={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/rúbrica/i), {
      target: { value: 'Criterio 1: rigor tecnico, 10 puntos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /interpretar rúbrica/i }));
    expect(await screen.findByText('Rigor tecnico')).toBeInTheDocument();
    expect(screen.getByText(/\(10 puntos\)/)).toBeInTheDocument();
  });

  it('muestra la categoria y el peso cuando existen', async () => {
    const client: JsonClient = {
      generateJson: vi.fn().mockResolvedValue({
        criteria: [
          {
            id: 'c1',
            name: 'Diseño',
            description: '',
            maxScore: 2,
            levels: [],
            group: 'Cálculos',
            weight: 30,
          },
        ],
        scale: { min: 0, max: 2 },
        source: 'Manual',
      }),
    } as unknown as JsonClient;
    render(<RubricPanel client={client} onConfirmed={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/rúbrica/i), { target: { value: 'Algo' } });
    fireEvent.click(screen.getByRole('button', { name: /interpretar rúbrica/i }));
    expect(await screen.findByText(/Cálculos · 30%/)).toBeInTheDocument();
  });

  it('deshabilita Confirmar hasta que haya criterios', async () => {
    const onConfirmed = vi.fn();
    render(<RubricPanel client={stubClient()} onConfirmed={onConfirmed} />);
    const confirm = screen.getByRole('button', { name: /confirmar rúbrica/i }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/rúbrica/i), { target: { value: 'Algo' } });
    fireEvent.click(screen.getByRole('button', { name: /interpretar rúbrica/i }));
    const confirmEnabled = (await screen.findByRole('button', { name: /confirmar rúbrica/i })) as HTMLButtonElement;
    expect(confirmEnabled.disabled).toBe(false);
    fireEvent.click(confirmEnabled);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('rellena el area con el borrador recibido', () => {
    const { rerender } = render(<RubricPanel client={stubClient()} onConfirmed={vi.fn()} />);
    rerender(<RubricPanel client={stubClient()} onConfirmed={vi.fn()} initialText="Borrador desde el lateral" />);
    expect(screen.getByLabelText(/rúbrica/i)).toHaveValue('Borrador desde el lateral');
  });
});
