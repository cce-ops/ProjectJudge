import { describe, it, expect } from 'vitest';
import { truncateText, findFigureCitations } from './text';

describe('truncateText', () => {
  it('truncates text to maxChars and adds a marker', () => {
    const result = truncateText('abcdef', 3);
    expect(result).toEqual({ text: 'abc[…]', truncated: true });
  });

  it('does not truncate text below the limit', () => {
    const result = truncateText('abc', 5);
    expect(result).toEqual({ text: 'abc', truncated: false });
  });

  it('handles empty strings', () => {
    const result = truncateText('', 5);
    expect(result).toEqual({ text: '', truncated: false });
  });
});

describe('findFigureCitations', () => {
  it('encuentra los numeros citados, ordenados y sin duplicados', () => {
    expect(findFigureCitations('Ver Figura 10, Figura 2 y Fig. 4. Otra vez Figura 2.')).toEqual([2, 4, 10]);
  });

  it('devuelve vacio sin citas', () => {
    expect(findFigureCitations('Texto sin figuras.')).toEqual([]);
  });
});
