import { describe, it, expect, vi } from 'vitest';
import { parseRubric } from './parseRubric';
import type { RubricModel } from '../../types/rubric';
import type { JsonClient } from '../ai/gemini';

describe('parseRubric', () => {
  it('normalizes criteria from AI response', async () => {
    const mockClient: JsonClient = {
      generateJson: vi.fn().mockResolvedValue({
        criteria: [
          { id: 'c1', name: 'Contenido', maxScore: 10, levels: [{ label: 'Excelente', descriptor: 'Perfecto', score: 10 }] },
        ],
        scale: { min: 0, max: 10 },
        source: 'Manual',
      }) as any,
    };
    const result = await parseRubric('Rúbrica de contenido técnico.', mockClient);
    expect((result as RubricModel).criteria.length).toBeGreaterThan(0);
    expect((result as RubricModel).criteria[0].name).toContain('Contenido');
  });

  it('uses cached result for identical text', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ criteria: [], scale: { min: 0, max: 10 }, source: '' });
    const mockClient: JsonClient = { generateJson: mockGenerate } as any;
    const cache = new Map();
    await parseRubric('Test rubric', mockClient, cache);
    await parseRubric('Test rubric', mockClient, cache);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('defaults maxScore to 10 if missing', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      criteria: [{ id: 'x', name: 'X', levels: [{ label: 'L', descriptor: '', score: 5 }] }],
      scale: { min: 0, max: 5 },
      source: '',
    });
    const mockClient: JsonClient = { generateJson: mockGenerate } as any;
    const result = await parseRubric('R', mockClient) as RubricModel;
    expect(result.criteria[0].maxScore).toBe(10);
  });
});
