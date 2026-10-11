export interface TemplateSlot { 
  id: string; 
  label: string; 
  description: string 
}
export interface DocumentMap {
  slots: { slot: TemplateSlot; present: boolean; sectionId: string | null }[];
  summary: string;
  titles: { sectionId: string; title: string }[];
}
export interface SectionCriterionResult {
  criterionId: string;
  score: number;
  maxScore: number;
  evidence: string;
  feedback: string;
  evaluable: boolean;
  motivo?: string;
}
export interface SectionEvaluation {
  sectionId: string;
  title: string;
  slotId: string | null;
  criteria: SectionCriterionResult[];
  strengths: string[];
  improvements: string[];
  figureNotes: { figureId: string; note: string }[];
  evaluated: boolean;
  error?: string;
}
export interface Synthesis {
  overallAssessment: 'Correcto' | 'Mejorable' | 'Insuficiente';
  summary: string;
  strengths: string[];
  improvements: string[];
  coherenceNotes: string[];
  referenceComparison: string;
  about: string;
  nextSteps: string[];
}
export interface ReportView {
  reportId: string; 
  createdAt: string; 
  model: string;
  rubric: import('./rubric').RubricModel; 
  document: { fileName: string; format: string; stats: import('./extract').ExtractedDocument['stats'] };
  map: DocumentMap; 
  sections: SectionEvaluation[]; 
  synthesis: Synthesis;
}
