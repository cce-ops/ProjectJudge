export interface TemplateSlot {
  id: string;
  label: string;
  description: string;
}

export const ENGINEERING_SECTIONS: TemplateSlot[] = [
  { id: 'antecedentes', label: 'Antecedentes y contexto', description: 'Estado del arte, revisión bibliográfica, marco teórico' },
  { id: 'objetivos', label: 'Objetivos', description: 'Objetivo general y específicos, alcance' },
  { id: 'alcance', label: 'Alcance', description: 'Límites del proyecto, inclusiones y exclusiones' },
  { id: 'metodologia', label: 'Metodología', description: 'Procedimientos, herramientas, datos' },
  { id: 'diseno', label: 'Diseño y desarrollo', description: 'Solución propuesta, arquitectura, prototipos' },
  { id: 'planificacion', label: 'Planificación', description: 'Cronograma, hitos, recursos asignados' },
  { id: 'presupuesto', label: 'Presupuesto', description: 'Estimación de costes, presupuesto desglosado' },
  { id: 'ambiental', label: 'Impacto ambiental', description: 'Evaluación, mitigación, cumplimiento normativo ambiental' },
  { id: 'normativa', label: 'Normativa aplicable', description: 'Reglamentos, códigos, estándares' },
  { id: 'riesgos', label: 'Análisis de riesgos', description: 'Identificación, valoración, planes de contingencia' },
  { id: 'conclusiones', label: 'Conclusiones y líneas futuras', description: 'Resultados, recomendaciones, trabajo futuro' },
  { id: 'bibliografia', label: 'Bibliografía', description: 'Referencias documentadas' },
  { id: 'anexos', label: 'Anexos', description: 'Material complementario, datos brutos, certificados' },
];

export const SECTION_KEYWORDS: string[] = [
  'antecedentes', 'contexto', 'estado del arte', 'bibliografía',
  'objetivos', 'propósito', 'finalidad',
  'alcance', 'límites', 'exclusiones',
  'metodología', 'procedimiento', 'método', 'enfoque',
  'diseño', 'desarrollo', 'arquitectura', 'prototipo', 'solución',
  'planificación', 'cronograma', 'calendario', 'hitos', 'milestones',
  'presupuesto', 'coste', 'financiación', 'recursos',
  'ambiental', 'impacto', 'sostenibilidad', 'mitigación',
  'normativa', 'reglamento', 'código', 'estándar', 'norma',
  'riesgos', 'contingencia', 'evaluación de riesgos',
  'conclusiones', 'recomendaciones', 'futuro',
  'anexos', 'apéndices',
];

export function findSlotByKeywords(title: string): TemplateSlot | null {
  const lowerTitle = title.toLowerCase();
  for (const slot of ENGINEERING_SECTIONS) {
    const keywords = [slot.id, slot.label.toLowerCase(), ...slot.description.toLowerCase().split(/[,\s]+/)].filter(Boolean);
    for (const kw of keywords) {
      if (lowerTitle.includes(kw)) return slot;
    }
  }
  return null;
}
