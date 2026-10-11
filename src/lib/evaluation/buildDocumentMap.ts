import type { ExtractedDocument } from '../../types/extract';
import type { DocumentMap, TemplateSlot } from '../../types/evaluation';
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
Apartados disponibles: ${ENGINEERING_SECTIONS.map((s: TemplateSlot) => s.id).join(', ')}.
Secciones del documento:
${document.sections.map((s) => `- [${s.id}] ${s.title || '(sin título)'}`).join('\n')}

Devuelve también, para cada sección detectada, un título corto y descriptivo (máximo 60 caracteres). Si el título original ya es descriptivo, consérvalo; si está vacío o es un resto de paginación, propone uno a partir de su contenido.`;

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
      titles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sectionId: { type: 'string' }, title: { type: 'string' },
          },
          required: ['sectionId', 'title'],
        },
      },
    },
    required: ['slots', 'summary', 'titles'],
  };

  const result = await client.generateJson({ prompt, schema, system: 'Eres un evaluador de proyectos de ingeniería.' });

  const slots = (result as any).slots || [];
  const aiTitles = Array.isArray((result as any).titles) ? (result as any).titles : [];
  const titles = document.sections.map((s) => {
    const proposed = aiTitles.find(
      (t: { sectionId: string; title: string }) => t.sectionId === s.id && typeof t.title === 'string' && t.title.trim()
    );
    return { sectionId: s.id, title: (proposed?.title ?? s.title).trim().slice(0, 60) || s.id };
  });
  const mappedSlots = ENGINEERING_SECTIONS.map((slot: TemplateSlot) => {
    const found = (slots as Array<{ slotId: string; present: boolean; sectionId: string | null }>).find(
      (s) => s.slotId === slot.id
    );
    if (found && found.present) {
      return { slot, present: true, sectionId: found.sectionId || null };
    }
    // Intentar heurística local
    const localSection = document.sections.find((s) => findSlotByKeywords(s.title)?.id === slot.id);
    if (localSection) {
      return { slot, present: true, sectionId: localSection.id };
    }
    return { slot, present: false, sectionId: null };
  });

  return {
    slots: mappedSlots,
    summary: (result as any).summary || 'Resumen no disponible.',
    titles,
  };
}
