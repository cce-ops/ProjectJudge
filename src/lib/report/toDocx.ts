import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { ReportView } from '../../types/evaluation';
import { buildReportBlocks } from './buildReport';

export async function toDocx(view: ReportView): Promise<Blob> {
  const blocks = buildReportBlocks(view);
  const children: Paragraph[] = [];
  for (const block of blocks) {
    children.push(
      new Paragraph({ text: block.heading, heading: HeadingLevel.HEADING_1 })
    );
    for (const paragraph of block.paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(paragraph)] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const bytes = Uint8Array.from(buffer);
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
