import { v4 as uuidv4 } from 'uuid';
import { Factor, Response, Run } from '../types';

export interface CenterPointGenerationResult {
  runs: Run[];
  warning?: string;
}

/**
 * Returns non-empty categorical level labels for a factor, never returning an empty array
 * or `undefined` entries (DES-20).
 */
export function getSafeCategoricalLevels(factor: Factor): string[] {
  if (Array.isArray(factor.levels)) {
    const cleaned = factor.levels
      .map(lv => String(lv ?? '').trim())
      .filter(lv => lv.length > 0);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return ['Level 1', 'Level 2'];
}

/**
 * Builds `count` centre-point runs for a design (P1.20 / DES-6, DES-19, DES-20, DES-21).
 * - Numeric factors are set to their midpoint `(min + max) / 2`.
 * - Categorical factors are distributed evenly across their levels (`levels[i % levels.length]`)
 *   rather than pinning every centre run to `levels[0]`.
 * - When the design has no continuous (numeric) factors (`DES-19`), adds 0 centre runs
 *   and returns a descriptive warning.
 * - Never writes `undefined` into `run.factors` (`DES-20`).
 */
export function buildCenterPointRuns(
  factors: Factor[],
  responses: Response[],
  count: number,
  startOrder: number = 1
): CenterPointGenerationResult {
  const nCenter = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  if (nCenter === 0) {
    return { runs: [] };
  }

  const continuousFactors = factors.filter(f => f.type === 'numeric');
  if (continuousFactors.length === 0) {
    return {
      runs: [],
      warning: 'Center points require at least one continuous numeric factor; 0 center runs were added.',
    };
  }

  const runs: Run[] = [];
  for (let i = 0; i < nCenter; i++) {
    const runFactors: Record<string, string | number> = {};
    for (const f of factors) {
      if (f.type === 'categorical') {
        const levels = getSafeCategoricalLevels(f);
        runFactors[f.id] = levels[i % levels.length];
      } else {
        runFactors[f.id] = Number(((f.min + f.max) / 2).toFixed(4));
      }
    }
    const order = startOrder + i;
    runs.push({
      id: uuidv4(),
      runOrder: order,
      stdOrder: order,
      factors: runFactors,
      responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
    });
  }

  return { runs };
}

/**
 * Builds `2 * k_continuous` axial (star) runs for augmenting a design to a face-centred CCD,
 * distributing categorical factors across their safe levels and never writing `undefined` (DES-20).
 */
export function buildAxialPointRuns(
  factors: Factor[],
  responses: Response[],
  startOrder: number = 1
): CenterPointGenerationResult {
  const continuousFactors = factors.filter(f => f.type === 'numeric');
  if (continuousFactors.length === 0) {
    return {
      runs: [],
      warning: 'Axial points require at least one continuous numeric factor; 0 axial runs were added.',
    };
  }

  const runs: Run[] = [];
  let idx = 0;
  for (const f of continuousFactors) {
    for (const level of [f.min, f.max]) {
      const runFactors: Record<string, string | number> = {};
      for (const otherF of factors) {
        if (otherF.id === f.id) {
          runFactors[otherF.id] = level;
        } else if (otherF.type === 'categorical') {
          const levels = getSafeCategoricalLevels(otherF);
          runFactors[otherF.id] = levels[idx % levels.length];
        } else {
          runFactors[otherF.id] = Number(((otherF.min + otherF.max) / 2).toFixed(4));
        }
      }
      const order = startOrder + idx;
      runs.push({
        id: uuidv4(),
        runOrder: order,
        stdOrder: order,
        factors: runFactors,
        responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
      });
      idx++;
    }
  }

  return { runs };
}
