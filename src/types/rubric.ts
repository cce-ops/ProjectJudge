export interface RubricLevel { 
  label: string; 
  descriptor: string; 
  score: number 
}
export interface RubricCriterion { 
  id: string; 
  name: string; 
  description: string; 
  levels: RubricLevel[]; 
  maxScore: number 
}
export interface RubricModel {
  criteria: RubricCriterion[]; 
  scale: { min: number; max: number };
  source: string; 
  fingerprint: string; 
  notes?: string;
}
