import { Factor } from '../types';

export interface EvaluatedPoint {
  score: number;
  d: number;
  y_hat: number;
}

export interface OptimizeFactorBoxOptions {
  seed?: number;
  refineContinuous?: boolean;
  maxStarts?: number;
}

export interface OptimizeFactorBoxResult {
  bestSettings: Record<string, string | number>;
  bestScore: number;
  bestD: number;
  bestPred: number;
  evaluations: number;
}

/**
 * Simple deterministic PRNG (Mulberry32) so multistart Latin-hypercube searches
 * are 100% reproducible for a given seed.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Latin Hypercube sample of `nSamples` points in [0, 1]^dim.
 */
function latinHypercube(nSamples: number, dim: number, rand: () => number): number[][] {
  if (dim === 0 || nSamples === 0) return [];
  const result: number[][] = Array.from({ length: nSamples }, () => new Array(dim).fill(0));
  for (let d = 0; d < dim; d++) {
    const perm = Array.from({ length: nSamples }, (_, i) => i);
    for (let i = nSamples - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    for (let i = 0; i < nSamples; i++) {
      result[i][d] = (perm[i] + rand()) / nSamples;
    }
  }
  return result;
}

/**
 * Maximises an objective over the factor domain without truncating factors >= 6 (STAT-4 / P0.8).
 *
 * - When the full 3-level numeric × categorical grid has <= 729 combinations, evaluates
 *   every combination in exact order (preserving complete backward compatibility on <= 6 factors).
 * - When the full grid exceeds 729 combinations, uses a deterministic seeded Latin-hypercube +
 *   axial/vertex start set followed by discrete coordinate search across `{min, mid, max}` (and all
 *   categorical levels) so every factor is searched and no factor is ever dropped or stuck at `min`.
 * - When `refineContinuous` is true (e.g. response surface models with active quadratic terms),
 *   follows up with bounded step-halving coordinate search over `[min, max]`.
 */
export function optimizeFactorBox(
  factors: Factor[],
  evaluate: (settings: Record<string, string | number>) => EvaluatedPoint,
  options: OptimizeFactorBoxOptions = {}
): OptimizeFactorBoxResult {
  const seed = options.seed ?? 20261021;
  const refineContinuous = options.refineContinuous ?? false;

  if (factors.length === 0) {
    const res = evaluate({});
    return { bestSettings: {}, bestScore: res.score, bestD: res.d, bestPred: res.y_hat, evaluations: 1 };
  }

  const factorCandidateValues: (string | number)[][] = factors.map(f => {
    if (f.type === 'categorical') {
      return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
    }
    const mid = (f.min + f.max) / 2;
    return [f.min, mid, f.max];
  });

  const totalGridSize = factorCandidateValues.reduce((acc, vals) => acc * Math.max(1, vals.length), 1);

  let bestSettings: Record<string, string | number> = {};
  let bestScore = -Infinity;
  let bestD = 0;
  let bestPred = 0;
  let evaluations = 0;

  const tryCandidate = (cand: Record<string, string | number>): boolean => {
    const { score, d, y_hat } = evaluate(cand);
    evaluations++;
    if (score > bestScore + 1e-12 || evaluations === 1) {
      bestScore = score;
      bestD = d;
      bestPred = y_hat;
      bestSettings = { ...cand };
      return true;
    }
    return false;
  };

  if (totalGridSize <= 729) {
    // Exact full 3-level × categorical Cartesian grid
    let combs: Record<string, string | number>[] = [{}];
    for (let fIdx = 0; fIdx < factors.length; fIdx++) {
      const f = factors[fIdx];
      const vals = factorCandidateValues[fIdx];
      const nextCombs: Record<string, string | number>[] = [];
      for (const comb of combs) {
        for (const v of vals) {
          nextCombs.push({ ...comb, [f.id]: v });
        }
      }
      combs = nextCombs;
    }
    for (const comb of combs) {
      tryCandidate(comb);
    }
  } else {
    // Large factor space: deterministic multistart + coordinate search over all factors
    const rand = mulberry32(seed);
    const nStarts = options.maxStarts ?? 32;
    const starts: Record<string, string | number>[] = [];

    // 1. Canonical anchor points: all-low, all-mid, all-high
    for (const levelIdx of [0, 1, 2]) {
      const pt: Record<string, string | number> = {};
      factors.forEach((f, idx) => {
        const vals = factorCandidateValues[idx];
        pt[f.id] = vals[Math.min(levelIdx, vals.length - 1)];
      });
      starts.push(pt);
    }

    // 2. Seeded Latin-hypercube starts across all factors
    const lhs = latinHypercube(nStarts, factors.length, rand);
    for (const row of lhs) {
      const pt: Record<string, string | number> = {};
      factors.forEach((f, idx) => {
        const vals = factorCandidateValues[idx];
        const pick = Math.min(vals.length - 1, Math.floor(row[idx] * vals.length));
        pt[f.id] = vals[pick];
      });
      starts.push(pt);
    }

    // Evaluate all starts and keep the top 6 distinct starts for full coordinate ascent
    const scoredStarts: { settings: Record<string, string | number>; score: number }[] = [];
    for (const st of starts) {
      const { score, d, y_hat } = evaluate(st);
      evaluations++;
      if (score > bestScore + 1e-12 || evaluations === 1) {
        bestScore = score;
        bestD = d;
        bestPred = y_hat;
        bestSettings = { ...st };
      }
      scoredStarts.push({ settings: st, score });
    }
    scoredStarts.sort((a, b) => b.score - a.score);

    const topStarts = scoredStarts.slice(0, 6);
    for (const startItem of topStarts) {
      let current = { ...startItem.settings };
      let currentScore = startItem.score;
      for (let pass = 0; pass < 8; pass++) {
        let improvedInPass = false;
        for (let fIdx = 0; fIdx < factors.length; fIdx++) {
          const f = factors[fIdx];
          const vals = factorCandidateValues[fIdx];
          for (const v of vals) {
            if (current[f.id] === v) continue;
            const cand = { ...current, [f.id]: v };
            const { score, d, y_hat } = evaluate(cand);
            evaluations++;
            if (score > currentScore + 1e-12) {
              currentScore = score;
              current = cand;
              improvedInPass = true;
              if (score > bestScore + 1e-12) {
                bestScore = score;
                bestD = d;
                bestPred = y_hat;
                bestSettings = { ...cand };
              }
            }
          }
        }
        if (!improvedInPass) break;
      }
    }
  }

  // Continuous bounded coordinate refinement (always run when refineContinuous is true)
  if (refineContinuous) {
    const numericFactors = factors.filter(f => f.type !== 'categorical');
    let currentSettings = { ...bestSettings };
    let stepScale = 0.25;
    for (let iter = 0; iter < 25; iter++) {
      let improved = false;
      for (const f of numericFactors) {
        const curVal = Number(currentSettings[f.id]);
        const step = (f.max - f.min) * stepScale;
        for (const dir of [-1, 1]) {
          const candVal = Math.max(f.min, Math.min(f.max, curVal + dir * step));
          const candMap = { ...currentSettings, [f.id]: candVal };
          if (tryCandidate(candMap)) {
            currentSettings = candMap;
            improved = true;
          }
        }
      }
      if (!improved) {
        stepScale *= 0.5;
        if (stepScale < 1e-5) break;
      }
    }
  }

  return { bestSettings, bestScore, bestD, bestPred, evaluations };
}

/**
 * Generates complete factor-setting candidates for multi-response grid/LHS optimization (MCP-11).
 * Never truncates the factor list; every returned candidate contains every factor ID.
 */
export function buildCompleteSearchCandidates(
  factors: Factor[],
  resolution: number = 10,
  maxCandidates: number = 5000,
  seed: number = 20261021
): Record<string, number | string>[] {
  if (factors.length === 0) return [{}];

  const factorGrids: { id: string; values: (number | string)[] }[] = factors.map(f => {
    if (f.type === 'categorical') {
      return {
        id: f.id,
        values: f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'],
      };
    }
    const step = (f.max - f.min) / Math.max(1, resolution - 1);
    const vals = Array.from({ length: resolution }, (_, i) => Number((f.min + i * step).toFixed(4)));
    return { id: f.id, values: vals };
  });

  const totalCombinations = factorGrids.reduce((acc, fg) => acc * Math.max(1, fg.values.length), 1);

  if (totalCombinations <= maxCandidates) {
    let combinations: Record<string, number | string>[] = [{}];
    for (const fg of factorGrids) {
      const nextCombs: Record<string, number | string>[] = [];
      for (const c of combinations) {
        for (const v of fg.values) {
          nextCombs.push({ ...c, [fg.id]: v });
        }
      }
      combinations = nextCombs;
    }
    return combinations;
  }

  // Deterministic LHS + anchor points across all factors when the full grid exceeds maxCandidates
  const rand = mulberry32(seed);
  const candidates: Record<string, number | string>[] = [];

  // Anchor points: min, mid, max
  for (const frac of [0, 0.5, 1]) {
    const pt: Record<string, number | string> = {};
    for (const fg of factorGrids) {
      const idx = Math.min(fg.values.length - 1, Math.floor(frac * (fg.values.length - 1)));
      pt[fg.id] = fg.values[idx];
    }
    candidates.push(pt);
  }

  const remaining = Math.max(0, maxCandidates - candidates.length);
  const lhs = latinHypercube(remaining, factors.length, rand);
  for (const row of lhs) {
    const pt: Record<string, number | string> = {};
    for (let i = 0; i < factorGrids.length; i++) {
      const fg = factorGrids[i];
      const idx = Math.min(fg.values.length - 1, Math.floor(row[i] * fg.values.length));
      pt[fg.id] = fg.values[idx];
    }
    candidates.push(pt);
  }

  return candidates;
}

export interface OptimizationGoalInput {
  goal: 'maximize' | 'minimize' | 'target';
  targetValue?: number | string | null;
  minLimit?: number;
  maxLimit?: number;
}

export interface ValidatedOptimizationOptions {
  goal: 'maximize' | 'minimize' | 'target';
  targetValue: number;
  minLimit: number;
  maxLimit: number;
}

/**
 * Validates and normalises single-response optimization options (P1.21 / STAT-10, UI-10).
 * - Uses `Number.isFinite` so `targetValue = 0` is preserved as `0` rather than replaced by `70`.
 * - Requires a finite target value when `goal === 'target'`, throwing a clear error if empty or non-finite.
 */
export function buildOptimizationOptions(input: OptimizationGoalInput): ValidatedOptimizationOptions {
  const goal = input.goal || 'maximize';
  const rawTarget = input.targetValue;

  const hasExplicitTarget =
    rawTarget !== null &&
    rawTarget !== undefined &&
    typeof rawTarget !== 'boolean' &&
    String(rawTarget).trim() !== '' &&
    Number.isFinite(Number(String(rawTarget).trim()));

  if (goal === 'target' && !hasExplicitTarget) {
    throw new Error('A finite numeric Target Value is required when the optimization goal is set to Target.');
  }

  const parsedTarget = hasExplicitTarget ? Number(String(rawTarget).trim()) : 70;
  const minLimit = Number.isFinite(input.minLimit) ? Number(input.minLimit) : 0;
  const maxLimit = Number.isFinite(input.maxLimit) ? Number(input.maxLimit) : 100;

  return {
    goal,
    targetValue: parsedTarget,
    minLimit,
    maxLimit,
  };
}

