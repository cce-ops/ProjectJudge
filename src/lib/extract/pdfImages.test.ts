import { describe, it, expect, vi } from 'vitest';
import { OPS } from 'pdfjs-dist';
import { extractPdf, pdfImageToRgba, groupTextItemsIntoLines, findCaptionPages } from './pdf';

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

describe('groupTextItemsIntoLines', () => {
  it('agrupa por coordenada Y y ordena por X', () => {
    const lines = groupTextItemsIntoLines([
      { str: 'mundo', transform: [1, 0, 0, 1, 50, 100], width: 30 },
      { str: 'Hola', transform: [1, 0, 0, 1, 10, 100], width: 20 },
      { str: 'Título', transform: [1, 0, 0, 1, 10, 200], width: 30 },
    ]);
    expect(lines).toEqual(['Título', 'Hola mundo']);
  });

  it('une sin espacio los fragmentos de palabra con hueco minimo', () => {
    const lines = groupTextItemsIntoLines([
      { str: 'renovabl', transform: [1, 0, 0, 1, 0, 100], width: 40 },
      { str: 'e', transform: [1, 0, 0, 1, 40.2, 100], width: 5 },
    ]);
    expect(lines).toEqual(['renovable']);
  });

  it('tolera pequeñas diferencias de Y en la misma linea', () => {
    const lines = groupTextItemsIntoLines([
      { str: 'A', transform: [1, 0, 0, 1, 0, 100], width: 8 },
      { str: 'B', transform: [1, 0, 0, 1, 20, 101.5], width: 8 },
    ]);
    expect(lines).toEqual(['A B']);
  });

  it('une con espacio cuando no hay metricas', () => {
    expect(groupTextItemsIntoLines([{ str: 'Antecedentes' }, { str: 'Texto.' }])).toEqual([
      'Antecedentes Texto.',
    ]);
  });
});

describe('findCaptionPages', () => {
  it('localiza las paginas con los pies citados', () => {
    const pages = [
      { pageNumber: 1, lines: ['Introducción general.'] },
      { pageNumber: 2, lines: ['Figura 7: Evolución horaria.'] },
      { pageNumber: 5, lines: ['Figura 9: Payback.'] },
    ];
    expect(findCaptionPages(pages, [7, 9])).toEqual([2, 5]);
    expect(findCaptionPages(pages, [3])).toEqual([]);
  });

  it('prioriza la pagina del pie sobre la que solo menciona', () => {
    const pages = [
      { pageNumber: 1, lines: ['Ver Figura 7 en el análisis.'] },
      { pageNumber: 2, lines: ['Figura 7: Evolución horaria.'] },
    ];
    expect(findCaptionPages(pages, [7])).toEqual([2, 1]);
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

  it('renderiza las paginas con figuras citadas cuando no hay imagenes', async () => {
    const file = { name: 'informe.pdf', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    const renderPage = vi.fn().mockImplementation(async () => ({
      base64: 'pagina-renderizada',
      width: 900,
      height: 1200,
      bytes: 120000,
    }));
    const getDocument = vi.fn().mockResolvedValue(
      docDouble([
        pageDouble({ lines: ['1. Resultados', 'Ver Figura 7 en el análisis.'] }),
        pageDouble({ lines: ['Figura 7: Evolución horaria del sistema.'] }),
      ])
    );
    const result = await extractPdf(file, { getDocument, renderImage: renderDouble, renderPage });
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(result.stats.figuresUsed).toBe(1);
    const withFigure = result.sections.find((s) => s.figureIds.length > 0);
    expect(withFigure).toBeDefined();
    expect(result.figures[0].id).toBe('fig-page-2');
  });

  it('no renderiza si ya hay imagenes cosechadas', async () => {
    const file = { name: 'informe.pdf', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    const renderPage = vi.fn();
    const getDocument = vi.fn().mockResolvedValue(
      docDouble([
        pageDouble({
          lines: ['1. Resultados', 'Ver Figura 7.'],
          images: [{ name: 'img1', ...rgbaImage(400, 300) }],
        }),
      ])
    );
    await extractPdf(file, { getDocument, renderImage: renderDouble, renderPage });
    expect(renderPage).not.toHaveBeenCalled();
  });

  it('respeta el tope de paginas renderizadas y avisa', async () => {
    const file = { name: 'informe.pdf', arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
    const renderPage = vi.fn().mockImplementation(async () => ({
      base64: 'pagina',
      width: 900,
      height: 1200,
      bytes: 120000,
    }));
    const getDocument = vi.fn().mockResolvedValue(
      docDouble([
        pageDouble({ lines: ['1. A', 'Ver Figura 1.'] }),
        pageDouble({ lines: ['Figura 1: primera.'] }),
        pageDouble({ lines: ['2. B', 'Ver Figura 2.'] }),
        pageDouble({ lines: ['Figura 2: segunda.'] }),
      ])
    );
    const result = await extractPdf(file, {
      getDocument,
      renderImage: renderDouble,
      renderPage,
      maxRenderedPages: 1,
    });
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(result.warnings.some((w) => w.includes('no se pudo visualizar'))).toBe(true);
  });
});
