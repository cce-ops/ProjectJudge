import type { RubricCriterion } from '../../types/rubric';

/**
 * Texto informativo de categoría y peso de un criterio ("Cálculos · 30%").
 * Solo informativo: nunca se usa para calcular notas.
 */
export function formatGroupWeight(criterion: Pick<RubricCriterion, 'group' | 'weight'>): string | null {
  const group = criterion.group?.trim();
  if (!group) return null;
  if (typeof criterion.weight === 'number' && Number.isFinite(criterion.weight)) {
    return `${group} · ${criterion.weight}%`;
  }
  return group;
}
