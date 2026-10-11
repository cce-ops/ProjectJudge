import type { ExtractedDocument, DocumentMap, TemplateSlot } from '../types/extract';
import { ENGINEERING_SECTIONS, findSlotByKeywords } from '../templates/sections';
import type { JsonClient } from '../ai/gemini';

export interface BuildDocumentMapInput {
  document: ExtractedDocument;
  client: JsonClient;
}

export async function buildDocumentMap(
  document: ExtractedDocument,
  client: JsonClient
): Promise<DocumentMap> {
  const prompt = `Analiza el informe y asigna cada sección a un apartado de ingeniería.
Apartados disponibles: ${ENGINEERING_SECTIONS.map(s => s.id).join(', ')}.
Secciones del documento:
${document.sections.map(s => `- ${s.title}`).join('\n')}`;

  const schema = {
    type: 'object',
    properties: {
      slots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slotId: { type: 'string' }, present: { type: 'boolean' }, sectionId: { type: 'string', nullable: true },
          },
          required: ['slotId', 'present', 'sectionId'],
        },
      },
      summary: { type: 'string' },
    },
    required: ['slots', 'summary'],
  };

  const result = await client.generateJson({ prompt, schema, system: 'Eres un evaluador de proyectos de ingeniería.' });

  const slots = (result as any).slots || [];
  const mappedSlots = ENGINEERING_SECTIONS.map(slot => {
    const found = (slots as any[]).find((s: any) => s.slotId === slot.id);
    if (found && found.present) {
      return { slot, present: true, sectionId: found.sectionId || null };
    }
    // Intentar heurística local
    const localSection = document.sections.find(s => findSlotByKeywords(s.title)?.id === slot.id);
    if (localSection) {
      return { slot, present: true, sectionId: localSection.id };
    }
    return { slot, present: false, sectionId: null };
  });

  return {
    slots: mappedSlots,
    summary: (result as any).summary || 'Resumen no disponible.',
  };
}
