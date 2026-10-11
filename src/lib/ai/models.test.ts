import { describe, it, expect } from 'vitest';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './models';

describe('modelos de Gemini', () => {
  it('usa gemini-3.8-flash por defecto', () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.8-flash');
    expect(AVAILABLE_MODELS[0]).toBe(DEFAULT_MODEL);
  });

  it('ofrece la lista vigente de modelos', () => {
    expect(AVAILABLE_MODELS).toEqual([
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]);
  });
});
