import type { RubricModel } from '../../types/rubric';
import type { JsonClient } from '../ai/gemini';

function fingerprint(text: string): string {
  return text.slice(0, 20).trim();
}

export async function parseRubric(
  rubricText: string,
  client: JsonClient,
  cache?: Map<string, RubricModel>
): Promise<RubricModel> {
  const fp = fingerprint(rubricText);
  if (cache && cache.has(fp)) {
    return cache.get(fp)!;
  }
  const schema = {
    type: 'object',
    properties: {
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            maxScore: { type: 'number' },
            group: { type: 'string' },
            weight: { type: 'number' },
            levels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  descriptor: { type: 'string' },
                  score: { type: 'number' },
                },
                required: ['label', 'descriptor', 'score'],
              },
            },
          },
          required: ['id', 'name', 'maxScore', 'levels'],
        },
      },
      scale: {
        type: 'object',
        properties: { min: { type: 'number' }, max: { type: 'number' } },
        required: ['min', 'max'],
      },
      source: { type: 'string' },
    },
    required: ['criteria', 'scale', 'source'],
  };

  const result = await client.generateJson({
    system: 'Eres un profesor de Proyectos de Ingenieria. Interpreta la rubrica y normalizala.',
    prompt: `Rubrica: ${rubricText}\n\nSi la rúbrica organiza los criterios en categorías o bloques con un peso porcentual (por ejemplo, Cálculos 30%), indica para cada criterio su categoría ("group") y su peso en tanto por ciento ("weight"). Si no hay pesos, omítelos.`,
    schema,
  });
  const rubric: RubricModel = {
    criteria: (result as any).criteria || [],
    scale: (result as any).scale || { min: 0, max: 10 },
    source: (result as any).source || 'Manual',
    fingerprint: fp,
    notes: '',
  };
  for (const c of rubric.criteria) {
    if (!c.maxScore || c.maxScore <= 0) c.maxScore = 10;
    if (!c.levels || c.levels.length === 0) {
      c.levels = [{ label: 'Aprobado', descriptor: 'Cumple el criterio', score: c.maxScore }];
    }
    if (typeof c.group === 'string') {
      const trimmed = c.group.trim().slice(0, 60);
      c.group = trimmed ? trimmed : undefined;
    } else {
      c.group = undefined;
    }
    c.weight =
      typeof c.weight === 'number' && Number.isFinite(c.weight) && c.weight >= 0 && c.weight <= 100
        ? c.weight
        : undefined;
  }
  if (cache) cache.set(fp, rubric);
  return rubric;
}
