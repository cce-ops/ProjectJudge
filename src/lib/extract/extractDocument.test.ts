import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
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
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Objetivos</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>Texto del objetivo.</w:t></w:r></w:p>` +
        `</w:body></w:document>`
    );
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = {
      name: 'test.docx',
      arrayBuffer: async () => buffer,
    } as unknown as File;
    const result = await extractDocument(file);
    expect(result.format).toBe('docx');
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections[0].title).toContain('Objetivos');
  });

  it('throws for unsupported file', async () => {
    const file = new File(['dummy'], 'test.exe', { type: 'application/octet-stream' });
    await expect(extractDocument(file)).rejects.toThrow('Formato no compatible');
  });
});
