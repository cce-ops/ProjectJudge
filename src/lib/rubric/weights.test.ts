import { describe, it, expect } from 'vitest';
import { formatGroupWeight } from './weights';

describe('formatGroupWeight', () => {
  it('muestra categoria y peso', () => {
    expect(formatGroupWeight({ group: 'Cálculos', weight: 30 })).toBe('Cálculos · 30%');
  });

  it('muestra solo la categoria sin peso valido', () => {
    expect(formatGroupWeight({ group: 'Datos' })).toBe('Datos');
    expect(formatGroupWeight({ group: 'Datos', weight: NaN })).toBe('Datos');
  });

  it('devuelve null sin categoria', () => {
    expect(formatGroupWeight({})).toBeNull();
    expect(formatGroupWeight({ group: '  ' })).toBeNull();
  });
});
