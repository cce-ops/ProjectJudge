import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractPdf } from './pdf';

describe('extractPdf', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('extracts text and sections from a PDF file', async () => {
    const mockFile = {
      name: 'test.pdf',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as File;
    
    const mockGetDocument = vi.fn().mockResolvedValue({
      numPages: 2,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Antecedentes' }, { str: 'Texto intro.' }, { str: 'Planificación' }, { str: 'Pasos.' }],
        }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: vi.fn(),
      }),
      cleanup: vi.fn(),
    });

    const result = await extractPdf(mockFile, { getDocument: mockGetDocument });
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.stats.pages).toBe(2);
  });

  it('warns when PDF has no extractable text', async () => {
    const mockFile = {
      name: 'empty.pdf',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as File;
    const mockGetDocument = vi.fn().mockResolvedValue({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({ items: [] }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: vi.fn(),
      }),
      cleanup: vi.fn(),
    });

    const result = await extractPdf(mockFile, { getDocument: mockGetDocument });
    expect(result.warnings.some((w: string) => w.toLowerCase().includes('texto'))).toBe(true);
  });
});
