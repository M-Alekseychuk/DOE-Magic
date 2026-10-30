import { Project, Run } from '../types';
import { computeAnalysis } from './analysisCore';

export interface ProjectModelOverrides {
  responseId?: string;
  excludedTerms?: string[];
  goal?: 'maximize' | 'minimize' | 'target';
  targetValue?: number;
}

/**
 * Fits each response in `project.responses` using its own saved `excludedTerms`,
 * applying optional transient UI overrides (`excludedTerms`, `goal`, `targetValue`)
 * only to the response matching `overrides.responseId` (STAT-7 / UI-3 / P0.6).
 */
export function fitProjectModels(
  project: Project,
  overrides?: ProjectModelOverrides
): any[] {
  if (!project.runs || project.runs.length === 0 || !project.responses || project.responses.length === 0 || !project.factors || project.factors.length === 0) {
    return [];
  }

  return project.responses
    .map(resp => {
      const isOverrideTarget = Boolean(overrides?.responseId && overrides.responseId === resp.id);
      const excluded = isOverrideTarget && overrides?.excludedTerms !== undefined
        ? overrides.excludedTerms
        : (resp.excludedTerms || []);
      const goal = isOverrideTarget && overrides?.goal !== undefined
        ? overrides.goal
        : resp.goal;
      const target = isOverrideTarget && overrides?.targetValue !== undefined
        ? overrides.targetValue
        : resp.targetValue;
      return computeAnalysis(project, resp, excluded, goal, target);
    })
    .filter(r => r !== null);
}

/**
 * Keyed dictionary version of `fitProjectModels` mapping `response.id -> analysisResult`.
 */
export function fitProjectModelsById(
  project: Project,
  overrides?: ProjectModelOverrides
): Record<string, any> {
  const map: Record<string, any> = {};
  for (const res of fitProjectModels(project, overrides)) {
    if (res?.response?.id) {
      map[res.response.id] = res;
    }
  }
  return map;
}

/**
 * Returns true if a response cell holds a recorded measurement (not null, undefined, or blank).
 */
export function isMeasuredValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  return !Number.isNaN(Number(val));
}

/**
 * Counts how many measured response values exist in `project.runs` (P0.2 / DES-1 / MCP-10).
 * When `responseId` is provided, counts only for that response; otherwise counts across all responses.
 */
export function countMeasuredValues(project: Project, responseId?: string): number {
  if (!project.runs || project.runs.length === 0) return 0;
  let count = 0;
  const responseIds = responseId
    ? [responseId]
    : project.responses.map(r => r.id);

  for (const run of project.runs) {
    if (!run.responses) continue;
    for (const rId of responseIds) {
      if (isMeasuredValue(run.responses[rId])) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Counts how many runs in `project.runs` have an empty (`null` / `undefined` / blank) cell for `responseId`.
 */
export function countEmptyResponseCells(project: Project, responseId: string): number {
  if (!project.runs || !responseId) return 0;
  return project.runs.filter(r => !isMeasuredValue(r.responses?.[responseId])).length;
}

/**
 * Pure helper for "Simulate Sample Data" (P0.2 / UI-2).
 * Populates ONLY empty (`null` / `undefined` / blank) cells for `responseId`,
 * never overwriting any existing non-null measured value.
 */
export function simulateSampleDataForResponse(
  project: Project,
  responseId: string
): { runs: Run[]; filledCount: number; preservedCount: number } {
  let filledCount = 0;
  let preservedCount = 0;

  const updatedRuns = project.runs.map((run, idx) => {
    const existing = run.responses?.[responseId];
    if (isMeasuredValue(existing)) {
      preservedCount++;
      return {
        ...run,
        factors: { ...run.factors },
        responses: { ...run.responses },
      };
    }

    let baseVal = 72.5;

    project.factors.forEach((f, fIdx) => {
      const factorVal = run.factors[f.id];
      if (f.type === 'categorical') {
        const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        const lvlIdx = levels.indexOf(String(factorVal));
        const contrast = lvlIdx === 0 ? -1 : lvlIdx === 1 ? 1 : 0;
        baseVal += (fIdx % 2 === 0 ? 8.4 : -6.2) * contrast;
      } else {
        const mid = (f.min + f.max) / 2;
        const range = f.max - f.min || 1;
        const coded = (Number(factorVal) - mid) / (range / 2);
        baseVal += (fIdx % 2 === 0 ? 11.5 : -8.3) * Math.max(-2, Math.min(2, coded));
      }
    });

    if (project.factors.length >= 2) {
      const f1 = project.factors[0];
      const f2 = project.factors[1];
      const c1 =
        f1.type === 'categorical'
          ? run.factors[f1.id] === (f1.levels?.[0] ?? '')
            ? -1
            : 1
          : (Number(run.factors[f1.id]) - (f1.min + f1.max) / 2) / ((f1.max - f1.min) / 2 || 1);
      const c2 =
        f2.type === 'categorical'
          ? run.factors[f2.id] === (f2.levels?.[0] ?? '')
            ? -1
            : 1
          : (Number(run.factors[f2.id]) - (f2.min + f2.max) / 2) / ((f2.max - f2.min) / 2 || 1);
      baseVal += 4.5 * c1 * c2;
    }

    const pseudoNoise = (((idx * 13 + 5) % 17) - 8) * 0.4;
    let finalVal = Number((baseVal + pseudoNoise).toFixed(2));
    if (finalVal < 0) finalVal = Math.abs(finalVal);

    filledCount++;
    return {
      ...run,
      factors: { ...run.factors },
      responses: {
        ...run.responses,
        [responseId]: finalVal,
      },
    };
  });

  return { runs: updatedRuns, filledCount, preservedCount };
}
