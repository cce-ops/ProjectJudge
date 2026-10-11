export interface Settings {
  apiKey: string;
  model: string;
  theme: 'light' | 'dark';
}
export interface ReferenceLabel {
  id: string;
  label: string;
  level: 'alto' | 'medio' | 'bajo';
}
export interface StoredReference {
  id: string;
  label: ReferenceLabel;
  fileName: string;
  savedAt: string;
  document: import('./extract').ExtractedDocument;
}
