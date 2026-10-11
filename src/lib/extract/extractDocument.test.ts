import { describe, it, expect, vi } from 'vitest';
import { extractDocument, isSupportedFile } from './extractDocument';

describe('isSupportedFile', () => {
  it('accepts supported formats', () => {
    expect(isSupportedFile(new File([''], 'test.pdf'))).toBe(true);
    expect(isSupportedFile(new File([''], 'test.docx'))).toBe(true);
    expect(isSupportedFile(new File([''], 'test.md'))).toBe(true);
    expect(isSupportedFile(new File([''], 'test.txt'))).toBe(true);
  });

  it('rejects unsupported formats', () => {
    expect(isSupportedFile(new File([''], 'test.exe'))).toBe(false);
  });
});

describe('extractDocument', () => {
  it('extracts markdown document', async () => {
    const file = {
      name: 'test.md',
      text: async () => '# Título\nTexto.',
    } as unknown as File;
    const result = await extractDocument(file);
    expect(result.format).toBe('md');
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('extracts docx document', async () => {
    const file = {
      name: 'test.docx',
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as File;
    const result = await extractDocument(file);
    expect(result.format).toBe('docx');
  });

  it('throws for unsupported file', async () => {
    const file = new File(['dummy'], 'test.exe', { type: 'application/octet-stream' });
    await expect(extractDocument(file)).rejects.toThrow('Formato no compatible');
  });
});
