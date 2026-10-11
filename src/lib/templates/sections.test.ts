import { describe, it, expect } from 'vitest';
import { ENGINEERING_SECTIONS, findSlotByKeywords } from './sections';

describe('ENGINEERING_SECTIONS', () => {
  it('has unique ids and non-empty labels', () => {
    const ids = ENGINEERING_SECTIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ENGINEERING_SECTIONS.forEach(s => {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    });
  });
});

describe('findSlotByKeywords', () => {
  it('finds the planning slot by keywords', () => {
    const slot = findSlotByKeywords('Planificación');
    expect(slot?.label).toContain('Planificación');
  });

  it('finds conclusions by keywords', () => {
    const slot = findSlotByKeywords('Conclusiones');
    expect(slot?.label).toContain('Conclusiones');
  });

  it('finds the budget slot', () => {
    const slot = findSlotByKeywords('5. PRESUPUESTO DETALLADO');
    expect(slot?.label).toContain('Presupuesto');
  });

  it('finds conclusions', () => {
    const slot = findSlotByKeywords('Conclusiones y líneas futuras');
    expect(slot?.label).toContain('Conclusiones');
  });

  it('returns null for unknown titles', () => {
    expect(findSlotByKeywords('Capítulo aleatorio sin relación')).toBeNull();
  });
});
