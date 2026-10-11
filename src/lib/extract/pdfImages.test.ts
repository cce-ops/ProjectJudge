import { describe, it, expect, vi } from 'vitest';
import { OPS } from 'pdfjs-dist';
import { extractPdf, pdfImageToRgba } from './pdf';

function pageDouble(options: {
  lines?: string[];
  images?: { name: string; width: number; height: number; kind: number; data: Uint8ClampedArray }[];
} = {}) {
  const { lines = ['1. Introducción', 'Texto.'], images = [] } = options;
  return {
    getTextContent: vi.fn().mockResolvedValue({
      items: lines.map((str) => ({ str })),
    }),
    getOperatorList: vi.fn().mockResolvedValue({
      fnArray: images.map(() => OPS.paintImageXObject),
      argsArray: images.map((img) => [img.name]),
    }),
    objs: {
      get: vi.fn().mockImplementation((name: string) => {
        const found = images.find((img) => img.name === name);
        if (!found) throw new Error(`Imagen no encontrada: ${name}`);
        return { width: found.width, height: found.height, kind: found.kind, data: found.data };
      }),
    },
    cleanup: vi.fn(),
  };
}

function docDouble(pages: ReturnType<typeof pageDouble>[]) {
  return {
    numPages: pages.length,
    getPage: vi.fn().mockImplementation(async (i: number) => pages[i - 1]),
    cleanup: vi.fn(),
  };
}

function rgbaImage(width: number, height: number) {
  return {
    width,
    height,
    kind: 3,
    data: new Uint8ClampedArray(width * height * 4).fill(128),
  };
}

describe('pdfImageToRgba', () => {
  it('pasa tal cual las RGBA', () => {
    const out = pdfImageToRgba({ width: 2, height: 1, kind: 3, data: new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]) });
    expect(out).not.toBeNull();
    expect([...out!.data]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('convierte RGB a RGBA opaco', () => {
    const out = pdfImageToRgba({ width: 1, height: 1, kind: 2, data: new Uint8ClampedArray([10, 20, 30]) });
    expect([...out!.data]).toEqual([10, 20, 30, 255]);
  });

  it('convierte escala de grises a RGBA', () => {
    const out = pdfImageToRgba({ width: 1, height: 1, kind: 1, data: new Uint8ClampedArray([200]) });
    expect([...out!.data]).toEqual([200, 200, 200, 255]);
  });

  it('descarta formatos desconocidos o vacios', () => {
    expect(pdfImageToRgba({ width: 0, height: 0, kind: 3, data: new Uint8ClampedArray([]) })).toBeNull();
    expect(pdfImageToRgba({ width: 1, height: 1, kind: 99, data: new Uint8ClampedArray([1]) })).toBeNull();
  });
});

describe('extractPdf con imagenes', () => {
  const renderDouble = vi.fn().mockImplementation(async (image: { width: number; height: number }) => ({
    base64: `img-${image.width}x${image.height}`,
    width: image.width,
    height: image.height,
    bytes: 50000,
  }));

  it('cosecha las imagenes embebidas y las enlaza con su pagina', async () => {
    const file = { name: 'informe.pdf', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    const getDocument = vi.fn().mockResolvedValue(
      docDouble([
        pageDouble({
          lines: ['1. Introducción', 'Texto introductorio.'],
          images: [{ name: 'img1', ...rgbaImage(400, 300) }],
        }),
      ])
    );
    const result = await extractPdf(file, { getDocument, renderImage: renderDouble });
    expect(result.stats.figuresUsed).toBe(1);
    expect(result.figures[0].mimeType).toBe('image/jpeg');
    expect(result.sections[0].figureIds).toEqual([result.figures[0].id]);
  });

  it('descarta las imagenes diminutas y avisa del recorte', async () => {
    const file = { name: 'informe.pdf', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    const getDocument = vi.fn().mockResolvedValue(
      docDouble([
        pageDouble({
          images: [
            { name: 'logo', ...rgbaImage(20, 20) },
            { name: 'grafico', ...rgbaImage(800, 600) },
          ],
        }),
      ])
    );
    const result = await extractPdf(file, { getDocument, renderImage: renderDouble });
    expect(result.stats.figuresUsed).toBe(1);
    expect(result.stats.figuresDiscarded).toBe(1);
  });

  it('tolera paginas cuya lista de operadores falla', async () => {
    const file = { name: 'informe.pdf', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    const broken = pageDouble();
    broken.getOperatorList = vi.fn().mockRejectedValue(new Error('sin operadores'));
    const getDocument = vi.fn().mockResolvedValue(docDouble([broken]));
    const result = await extractPdf(file, { getDocument, renderImage: renderDouble });
    expect(result.stats.figuresUsed).toBe(0);
    expect(result.sections.length).toBeGreaterThan(0);
  });
});
