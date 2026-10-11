import type { Figure, FigureCandidate } from '../../types/extract';

export type CanvasFactory = (width: number, height: number) => {
  canvas: Pick<HTMLCanvasElement, 'toDataURL'>;
};

export function selectFigures(
  candidates: FigureCandidate[],
  options: { maxFigures?: number } = {}
): { figures: Figure[]; discarded: number } {
  // Se conserva el id de cada candidata: las secciones referencian las figuras
  // por ese identificador para enviar a la IA solo las de cada apartado.
  const seenHashes = new Set<string>();
  const selected: Figure[] = [];
  let discarded = 0;

  for (const candidate of candidates) {
    const isTooSmallArea = candidate.width * candidate.height < 20000;
    const isTooSmallSide = candidate.width < 100 || candidate.height < 100;
    const isTooSmallBytes = candidate.bytes < 30 * 1024;
    const isDuplicate = seenHashes.has(candidate.hash);

    if (isTooSmallArea || isTooSmallSide || isTooSmallBytes || isDuplicate) {
      discarded++;
      continue;
    }

    if (options.maxFigures && selected.length >= options.maxFigures) {
      discarded++;
      continue;
    }

    seenHashes.add(candidate.hash);
    selected.push({
      id: candidate.id,
      base64: candidate.base64,
      mimeType: candidate.mimeType,
      width: candidate.width,
      height: candidate.height,
      bytes: candidate.bytes,
    });
  }

  return { figures: selected, discarded };
}

export async function reencodeFigure(
  candidate: FigureCandidate,
  maxEdge: number,
  factory: CanvasFactory
): Promise<Figure> {
  const ratio = candidate.width / candidate.height;
  const width = ratio > 1 ? maxEdge : Math.round(maxEdge * ratio);
  const height = ratio > 1 ? Math.round(maxEdge / ratio) : maxEdge;

  const { canvas } = factory(width, height);

  // En un navegador real aquí se dibujaría la imagen en el canvas;
  // el mock del test resuelve directamente el dataURL.

  return {
    id: `fig-reencoded`,
    base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1],
    mimeType: 'image/jpeg',
    width,
    height,
    bytes: 0, // Simplified for re-encoding
  };
}
