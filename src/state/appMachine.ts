import type { Settings } from '../types/app';
import type { ExtractedDocument } from '../types/extract';
import type { RubricModel } from '../types/rubric';
import type { ReportView } from '../types/evaluation';
import type { ReferenceSummary } from '../lib/evaluation/orchestrate';
import { DEFAULT_SETTINGS } from '../lib/storage/settings';

export type Step = 'rubric' | 'documents' | 'mapping' | 'sections' | 'synthesizing' | 'results';

export interface EvaluationProgressState {
  phase: 'map' | 'sections' | 'synthesis';
  sectionIndex?: number;
  sectionTotal?: number;
  sectionTitle?: string;
}

export interface AppState {
  step: Step;
  settings: Settings;
  rubric: RubricModel | null;
  document: ExtractedDocument | null;
  references: ReferenceSummary[];
  report: ReportView | null;
  progress: EvaluationProgressState | null;
  error: string | null;
}

export type AppAction =
  | { type: 'rubric/parsed'; rubric: RubricModel }
  | { type: 'rubric/failed'; error: string }
  | { type: 'rubric/cleared' }
  | { type: 'references/added'; reference: ReferenceSummary }
  | { type: 'references/removed'; fileName: string }
  | { type: 'documents/extracted'; document: ExtractedDocument }
  | { type: 'documents/submitted' }
  | { type: 'evaluation/progress'; progress: EvaluationProgressState }
  | { type: 'evaluation/done'; report: ReportView }
  | { type: 'evaluation/failed'; error: string }
  | { type: 'evaluation/reset' }
  | { type: 'settings/updated'; settings: Settings }
  | { type: 'error/dismissed' };

export function initialState(settings?: Settings): AppState {
  return {
    step: 'rubric',
    settings: settings ? { ...settings } : { ...DEFAULT_SETTINGS },
    rubric: null,
    document: null,
    references: [],
    report: null,
    progress: null,
    error: null,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'rubric/parsed':
      return { ...state, rubric: action.rubric, step: 'documents', error: null };
    case 'rubric/failed':
      return { ...state, error: action.error };
    case 'rubric/cleared':
      return { ...state, rubric: null, step: 'rubric' };
    case 'references/added':
      if (state.references.length >= 2) return state;
      if (state.references.some((r) => r.fileName === action.reference.fileName)) return state;
      return { ...state, references: [...state.references, action.reference] };
    case 'references/removed':
      return { ...state, references: state.references.filter((r) => r.fileName !== action.fileName) };
    case 'documents/extracted':
      return { ...state, document: action.document, step: 'mapping', error: null, progress: null };
    case 'documents/submitted':
      if (!state.settings.apiKey) {
        return { ...state, error: 'Introduce tu API key de Gemini en la barra lateral.' };
      }
      return { ...state, error: null };
    case 'evaluation/progress': {
      const step: Step =
        action.progress.phase === 'map'
          ? 'mapping'
          : action.progress.phase === 'sections'
            ? 'sections'
            : 'synthesizing';
      return { ...state, progress: action.progress, step, error: null };
    }
    case 'evaluation/done':
      return { ...state, report: action.report, step: 'results', progress: null, error: null };
    case 'evaluation/failed':
      return { ...state, error: action.error, step: 'documents', progress: null };
    case 'evaluation/reset':
      return { ...state, document: null, report: null, progress: null, error: null, step: 'documents' };
    case 'settings/updated':
      return { ...state, settings: action.settings };
    case 'error/dismissed':
      return { ...state, error: null };
    default:
      return state;
  }
}
