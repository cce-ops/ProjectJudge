import { describe, it, expect } from 'vitest';
import { documentXmlToModel } from './docxModel';

describe('documentXmlToModel', () => {
  it('extracts sections from DOCX XML with headings', () => {
    const xml = `<w:body xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:p><w:pStyle w:val="Heading1"/><w:r><w:t>Antecedentes</w:t></w:r></w:p>
      <w:p><w:r><w:t>Texto de antecedente.</w:t></w:r></w:p>
    </w:body>`;
    const media: any = {};
    const { sections } = documentXmlToModel(xml, media);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toContain('Antecedentes');
    expect(sections[0].text).toContain('Texto de antecedente');
  });

  it('handles DOCX without headings', () => {
    const xml = `<w:body xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Texto sin encabezados.</w:t></w:r></w:p></w:body>`;
    const { sections, warnings } = documentXmlToModel(xml, {});
    expect(sections.length).toBe(1);
    expect(warnings.some(w => w.includes('encabezados'))).toBe(true);
  });
});
