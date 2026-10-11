import type { DocumentCheck } from '../../types/evaluation';
import { findFigureCitations } from '../text';

function citedNumbers(text: string, pattern: RegExp): number[] {
  const found = new Set<number>();
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(global)) {
    const value = Number(match[1] ?? match[2]);
    if (Number.isInteger(value) && value > 0 && value < 1000) {
      found.add(value);
    }
  }
  return [...found].sort((a, b) => a - b);
}

function missingInSequence(cited: number[]): number[] {
  if (cited.length === 0) return [];
  const present = new Set(cited);
  const missing: number[] = [];
  for (let n = 1; n <= cited[cited.length - 1]; n++) {
    if (!present.has(n)) missing.push(n);
  }
  return missing;
}

/**
 * Comprobaciones mecánicas sobre el documento (sin IA): figuras y tablas citadas
 * frente a las detectadas, saltos de numeración y mezcla de separadores decimales.
 */
export function buildChecks(text: string, figuresDetected: number): DocumentCheck[] {
  const checks: DocumentCheck[] = [];

  const figures = findFigureCitations(text);
  if (figures.length > 0) {
    checks.push({
      id: 'figuras-citadas',
      passed: figuresDetected >= figures.length,
      message: `Figuras citadas en el texto: ${figures.join(', ')} (${figures.length}); imágenes detectadas en el documento: ${figuresDetected}.`,
    });
    const gaps = missingInSequence(figures);
    if (gaps.length > 0) {
      checks.push({
        id: 'figuras-huecos',
        passed: false,
        message: `La numeración de figuras salta los números: ${gaps.join(', ')}. Revisa que estén todas citadas e incluidas.`,
      });
    }
  }

  const tables = citedNumbers(text, /Tabla\s*(\d+)/gi);
  if (tables.length > 0) {
    checks.push({
      id: 'tablas-citadas',
      passed: true,
      message: `Tablas citadas en el texto: ${tables.join(', ')} (${tables.length}).`,
    });
    const gaps = missingInSequence(tables);
    if (gaps.length > 0) {
      checks.push({
        id: 'tablas-huecos',
        passed: false,
        message: `La numeración de tablas salta los números: ${gaps.join(', ')}. Revisa que estén todas citadas e incluidas.`,
      });
    }
  }

  const commaDecimals = (text.match(/\d,\d/g) ?? []).length;
  const dotDecimals = (text.match(/\d\.\d/g) ?? []).length;
  if (commaDecimals >= 2 && dotDecimals >= 2) {
    checks.push({
      id: 'decimales',
      passed: false,
      message: `Se mezclan coma y punto como separador decimal (${commaDecimals} con coma, ${dotDecimals} con punto). Unifica el formato en todo el documento.`,
    });
  }

  return checks;
}
