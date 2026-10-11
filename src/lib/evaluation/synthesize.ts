import type { DocumentMap, SectionEvaluation, Synthesis } from '../../types/evaluation';
import type { RubricModel } from '../../types/rubric';
import type { JsonClient } from '../ai/gemini';

interface SynthesizeInput {
  map: DocumentMap;
  sections: SectionEvaluation[];
  rubric: RubricModel;
  referenceLabels: string[];
}

export async function synthesize(
  input: SynthesizeInput,
  client: JsonClient
): Promise<Synthesis> {
  const evaluatedSections = input.sections.filter((s: SectionEvaluation) => s.evaluated);
  if (evaluatedSections.length === 0) {
    throw new Error('No hay secciones evaluadas para sintetizar.');
  }

  const criteriaSummary = input.rubric.criteria.map((c: { name: string; maxScore: number }) => `${c.name} (0-${c.maxScore})`).join('; ');
  const sectionsSummary = input.sections.map((s: SectionEvaluation) => {
    if (!s.evaluated) return `- ${s.title}: NO EVALUADA (${s.error || 'límite de secciones'})`;
    const scores = s.criteria.map((c: { criterionId: string; score: number; maxScore: number }) => `${c.criterionId}:${c.score}/${c.maxScore}`).join(', ');
    return `- ${s.title} [${s.slotId || 'sin apartado'}]: ${scores}`;
  }).join('\n');

  const referenceNote = input.referenceLabels.length > 0
    ? `Referencia(s): ${input.referenceLabels.join(', ')}.`
    : 'Sin informes de referencia.';

  const prompt = `Eres un profesor de Proyectos de Ingeniería. A partir de la evaluación estructurada, genera una síntesis cualitativa.

Criterios evaluados: ${criteriaSummary}

Secciones evaluadas:
${sectionsSummary}

${referenceNote}

Mapa de apartados: ${input.map.slots.map((s: { slot: { id: string }; present: boolean }) => `${s.slot.id}:${s.present ? 'presente' : 'ausente'}`).join(', ')}
Resumen del documento: ${input.map.summary}

Instrucciones:
- overallAssessment debe ser EXACTAMENTE una de: "Correcto", "Mejorable", "Insuficiente".
- No incluyas ninguna nota numérica global; solo puntuaciones por criterio.
- about: describe en 2-3 frases de qué trata el informe evaluado (tema, alcance y estructura), sin valorarlo.
- nextSteps: como máximo 3 acciones concretas y priorizadas que permitan subir de nivel en la próxima entrega.
- Escribe en español, 2-3 frases de resumen, fortalezas, mejoras, coherencia entre apartados y comparación con referencias.`;

  const schema = {
    type: 'object',
    properties: {
      overallAssessment: { type: 'string', enum: ['Correcto', 'Mejorable', 'Insuficiente'] },
      summary: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      improvements: { type: 'array', items: { type: 'string' } },
      coherenceNotes: { type: 'array', items: { type: 'string' } },
      referenceComparison: { type: 'string' },
      about: { type: 'string' },
      nextSteps: { type: 'array', items: { type: 'string' } },
    },
    required: ['overallAssessment', 'summary', 'strengths', 'improvements', 'coherenceNotes', 'referenceComparison', 'about', 'nextSteps'],
  };

  const result = await client.generateJson({ prompt, schema, system: 'Evaluador académico riguroso.' });
  const assessment = (result as any).overallAssessment;
  if (!['Correcto', 'Mejorable', 'Insuficiente'].includes(assessment)) {
    throw new Error(`Valoración global no permitida: "${assessment}"`);
  }

  const nextSteps = Array.isArray((result as any).nextSteps)
    ? (result as any).nextSteps.filter((s: unknown) => typeof s === 'string').slice(0, 3)
    : [];

  return {
    overallAssessment: assessment as 'Correcto' | 'Mejorable' | 'Insuficiente',
    summary: (result as any).summary || '',
    strengths: (result as any).strengths || [],
    improvements: (result as any).improvements || [],
    coherenceNotes: (result as any).coherenceNotes || [],
    referenceComparison: (result as any).referenceComparison || '',
    about: (result as any).about || '',
    nextSteps,
  };
}
