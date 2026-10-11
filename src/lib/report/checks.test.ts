import { describe, it, expect } from 'vitest';
import { buildChecks } from './checks';

describe('buildChecks', () => {
  it('resume las figuras citadas frente a las detectadas', () => {
    const checks = buildChecks('Como se ve en la Figura 2 y en la Figura 4, la Figura 10 resume.', 7);
    const counts = checks.find((c) => c.id === 'figuras-citadas');
    expect(counts?.message).toContain('2, 4, 10');
    expect(counts?.message).toContain('7');
  });

  it('avisa cuando la numeracion de figuras salta numeros', () => {
    const checks = buildChecks('Ver Figura 1 y Figura 3.', 5);
    const gaps = checks.find((c) => c.id === 'figuras-huecos');
    expect(gaps?.passed).toBe(false);
    expect(gaps?.message).toContain('2');
  });

  it('no emite avisos de figuras si no se cita ninguna', () => {
    const checks = buildChecks('Texto sin figuras.', 0);
    expect(checks.some((c) => c.id.startsWith('figuras'))).toBe(false);
  });

  it('resume las tablas citadas y sus huecos', () => {
    const checks = buildChecks('La Tabla 1 y la Tabla 2 muestran los datos.', 0);
    expect(checks.find((c) => c.id === 'tablas-citadas')?.message).toContain('1, 2');
    expect(checks.some((c) => c.id === 'tablas-huecos')).toBe(false);
  });

  it('avisa cuando se mezclan coma y punto como separador decimal', () => {
    const text = 'Valores de 203.71 y 80917.5 frente a 64,3 y 8,21 y 13,76 y 5,39 y 2,44 y 3,69.';
    const checks = buildChecks(text, 0);
    const decimals = checks.find((c) => c.id === 'decimales');
    expect(decimals?.passed).toBe(false);
    expect(decimals?.message).toMatch(/coma y punto/i);
  });

  it('no avisa con un solo estilo decimal', () => {
    const checks = buildChecks('Valores 64,3 y 8,21 y 13,76.', 0);
    expect(checks.some((c) => c.id === 'decimales')).toBe(false);
  });
});
