import { describe, it, expect } from 'vitest';
import { readRubricFile } from './readRubricFile';

describe('readRubricFile', () => {
  it('lee una rubrica en Markdown', async () => {
    const file = {
      name: 'rubrica.md',
      text: async () => '# Criterios\n- Rigor: 10 puntos',
    } as unknown as File;
    const result = await readRubricFile(file);
    expect(result.source).toBe('rubrica.md');
    expect(result.text).toContain('Rigor');
  });

  it('rechaza formatos no compatibles con un mensaje claro', async () => {
    const file = { name: 'rubrica.exe' } as unknown as File;
    await expect(readRubricFile(file)).rejects.toThrow(/no compatible/i);
  });

  it('indica que el .xls clasico ya no esta soportado', async () => {
    const file = { name: 'rubrica.xls', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    await expect(readRubricFile(file)).rejects.toThrow(/ya no está soportado/i);
  });
});
