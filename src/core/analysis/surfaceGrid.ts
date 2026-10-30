import { Factor, Project } from '../types';
import { AnalysisResult, predictModelResponse } from './analysisCore';

export interface SurfaceGridResult {
  xFactorId: string;
  yFactorId: string;
  xBounds: { min: number; max: number };
  yBounds: { min: number; max: number };
  gridX: number[];
  gridY: number[];
  /** zGrid[yIdx][xIdx] evaluated with predictModelResponse at (gridX[xIdx], gridY[yIdx]) and fixedSettings. */
  zGrid: number[][];
  minZ: number;
  maxZ: number;
  fixedSettings: Record<string, number | string>;
}

export function getSurfaceFactorBounds(f: Factor): { min: number; max: number } {
  if (f.type === 'categorical') {
    const count = Math.max(2, f.levels && f.levels.length > 0 ? f.levels.length : 2);
    return { min: 0, max: count - 1 };
  }
  const min = typeof f.min === 'number' && Number.isFinite(f.min) ? f.min : 0;
  const max = typeof f.max === 'number' && Number.isFinite(f.max) ? f.max : min + 1;
  return { min, max: max <= min ? min + 1 : max };
}

export function axisCoordToFactorSetting(f: Factor, coord: number): number | string {
  if (f.type === 'categorical') {
    const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
    const idx = Math.max(0, Math.min(levels.length - 1, Math.round(coord)));
    return levels[idx];
  }
  return coord;
}

export function defaultFixedFactorSettings(
  project: Project,
  overrides?: Record<string, number | string>
): Record<string, number | string> {
  const settings: Record<string, number | string> = {};
  for (const f of project.factors) {
    const overrideVal = overrides?.[f.id] !== undefined ? overrides[f.id] : overrides?.[f.name];
    if (overrideVal !== undefined) {
      settings[f.id] = overrideVal;
    } else if (f.type === 'categorical') {
      settings[f.id] = f.levels && f.levels.length > 0 ? f.levels[0] : 'Level 1';
    } else {
      const bounds = getSurfaceFactorBounds(f);
      settings[f.id] = (bounds.min + bounds.max) / 2;
    }
  }
  return settings;
}

/**
 * Evaluates a 2D response surface grid from the fitted regression model using `predictModelResponse`
 * (P0.10 / STAT-8 / UI-4). Off-axis numeric factors default to their midpoint and categorical
 * factors are held at an explicit level (defaulting to their first level).
 */
export function surfaceGrid(
  result: AnalysisResult | any,
  project: Project,
  xId: string,
  yId: string,
  fixedSettings?: Record<string, number | string>,
  size: number = 25
): SurfaceGridResult | null {
  if (!result || project.factors.length < 2) return null;

  const xFactor =
    project.factors.find(f => f.id === xId || f.name === xId) || project.factors[0];
  const yFactor =
    project.factors.find(f => (f.id === yId || f.name === yId) && f.id !== xFactor.id) ||
    project.factors.find(f => f.id !== xFactor.id) ||
    project.factors[1] ||
    project.factors[0];

  const steps = Math.max(2, Math.floor(size));
  const xBounds = getSurfaceFactorBounds(xFactor);
  const yBounds = getSurfaceFactorBounds(yFactor);
  const resolvedFixed = defaultFixedFactorSettings(project, fixedSettings);

  const gridX = Array.from(
    { length: steps },
    (_, j) => xBounds.min + ((xBounds.max - xBounds.min) * j) / (steps - 1)
  );
  const gridY = Array.from(
    { length: steps },
    (_, i) => yBounds.min + ((yBounds.max - yBounds.min) * i) / (steps - 1)
  );

  const zGrid: number[][] = [];
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < steps; i++) {
    const row: number[] = [];
    const ySetting = axisCoordToFactorSetting(yFactor, gridY[i]);
    for (let j = 0; j < steps; j++) {
      const xSetting = axisCoordToFactorSetting(xFactor, gridX[j]);
      const pointSettings: Record<string, number | string> = {
        ...resolvedFixed,
        [xFactor.id]: xSetting,
        [yFactor.id]: ySetting,
      };
      const pred = predictModelResponse(result, pointSettings, project);
      const val = Number.isFinite(pred) ? pred : 0;
      if (val < minZ) minZ = val;
      if (val > maxZ) maxZ = val;
      row.push(val);
    }
    zGrid.push(row);
  }

  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    minZ = 0;
    maxZ = 1;
  }

  return {
    xFactorId: xFactor.id,
    yFactorId: yFactor.id,
    xBounds,
    yBounds,
    gridX,
    gridY,
    zGrid,
    minZ,
    maxZ,
    fixedSettings: resolvedFixed,
  };
}

/**
 * Precomputes response surface grids for the default factor pair plus up to `maxPairs`
 * unordered factor pairs so exported HTML reports can render exact fitted surfaces (P0.10).
 */
export function buildProjectSurfaceGrids(
  result: AnalysisResult | any,
  project: Project,
  fixedSettings?: Record<string, number | string>,
  size: number = 25,
  maxPairs: number = 15
): Record<string, SurfaceGridResult> {
  const grids: Record<string, SurfaceGridResult> = {};
  if (!result || project.factors.length < 2) return grids;

  let count = 0;
  for (let i = 0; i < project.factors.length; i++) {
    for (let j = i + 1; j < project.factors.length; j++) {
      if (count >= maxPairs) return grids;
      const f1 = project.factors[i];
      const f2 = project.factors[j];
      const grid = surfaceGrid(result, project, f1.id, f2.id, fixedSettings, size);
      if (grid) {
        grids[`${f1.id}__${f2.id}`] = grid;
        count++;
      }
    }
  }
  return grids;
}
