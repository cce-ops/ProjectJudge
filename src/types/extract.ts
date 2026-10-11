export interface Figure { 
  id: string; 
  base64: string; 
  mimeType: string; 
  width: number; 
  height: number; 
  bytes: number 
}
export interface Section { 
  id: string; 
  title: string; 
  level: number; 
  text: string; 
  pageStart?: number; 
  pageEnd?: number; 
  figureIds: string[] 
}
export interface ExtractedDocument {
  fileName: string; 
  format: 'pdf' | 'docx' | 'md';
  text: string; 
  sections: Section[]; 
  figures: Figure[];
  warnings: string[];
  stats: { pages?: number; words: number; figuresUsed: number; figuresDiscarded: number };
}
export interface FigureCandidate {
  id: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  sourcePage?: number;
}
