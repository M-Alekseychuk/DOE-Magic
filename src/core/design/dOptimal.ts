import { Factor } from '../types';

export interface CandidateRun {
  natural: Record<string, string | number>;
  coded: number[]; // Model vector: [1 (Intercept), x1, x2, ...]
}

/**
 * Generates coded contrast columns for a factor value.
 * - Numeric factors: scaled to [-1, +1]
 * - 2-level Categorical factors: coded as [-1, +1]
 * - Multi-level Categorical factors (L >= 3): L-1 sum-to-zero effect-coded columns
 */
export function encodeFactorContrasts(factor: Factor, val: string | number): number[] {
  if (factor.type === 'categorical') {
    const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
    const L = levels.length;
    const idx = levels.findIndex(lv => lv.trim().toLowerCase() === String(val).trim().toLowerCase());
    const safeIdx = idx === -1 ? 0 : idx;

    if (L <= 2) {
      return [safeIdx === 1 ? 1 : -1];
    }

    // Effect coding (sum-to-zero): last level is reference (-1 across all L-1 columns)
    const cols = new Array(L - 1).fill(0);
    if (safeIdx === L - 1) {
      for (let c = 0; c < L - 1; c++) cols[c] = -1;
    } else {
      cols[safeIdx] = 1;
    }
    return cols;
  } else {
    const numVal = Number(val);
    if (!Number.isFinite(numVal)) return [0];
    const mid = (factor.min + factor.max) / 2;
    const halfRange = (factor.max - factor.min) / 2;
    if (halfRange === 0) return [0];
    return [(numVal - mid) / halfRange];
  }
}

/**
 * Builds the model expansion vector for a candidate point.
 * Supports main effects (with multi-level categorical contrasts),
 * optionally 2-factor interactions when candidate budget allows,
 * and optionally quadratic terms for 3-level numeric candidates.
 */
export function buildCodedModelRow(
  factors: Factor[],
  naturalPoint: Record<string, string | number>,
  includeInteractions: boolean = false,
  includeQuadratics: boolean = false
): number[] {
  const row: number[] = [1]; // Intercept
  const factorContrasts: number[][] = [];

  for (const f of factors) {
    const c = encodeFactorContrasts(f, naturalPoint[f.id]);
    factorContrasts.push(c);
    row.push(...c);
  }

  if (includeInteractions) {
    for (let i = 0; i < factors.length; i++) {
      for (let j = i + 1; j < factors.length; j++) {
        for (const c1 of factorContrasts[i]) {
          for (const c2 of factorContrasts[j]) {
            row.push(c1 * c2);
          }
        }
      }
    }
  }

  if (includeQuadratics) {
    for (let i = 0; i < factors.length; i++) {
      if (factors[i].type === 'numeric') {
        const c = factorContrasts[i][0] ?? 0;
        row.push(c * c);
      }
    }
  }

  return row;
}

/**
 * Computes log(|X'X + ridge * I|) using Cholesky decomposition for candidate exchange.
 */
export function computeLogDetXtX(X: number[][], ridge: number = 1e-6): number {
  const n = X.length;
  if (n === 0) return -Infinity;
  const p = X[0].length;

  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let r = 0; r < n; r++) {
    const row = X[r];
    for (let i = 0; i < p; i++) {
      const xi = row[i];
      for (let j = i; j < p; j++) {
        XtX[i][j] += xi * row[j];
      }
    }
  }
  for (let i = 0; i < p; i++) {
    XtX[i][i] += ridge;
    for (let j = 0; j < i; j++) {
      XtX[i][j] = XtX[j][i];
    }
  }

  // Cholesky decomposition L * L' = XtX
  const L: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  let logDet = 0;

  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = XtX[i][j];
      for (let k = 0; k < j; k++) {
        sum -= L[i][k] * L[j][k];
      }
      if (i === j) {
        if (sum <= 1e-12) return -Infinity;
        L[i][j] = Math.sqrt(sum);
        logDet += 2 * Math.log(L[i][j]);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }

  return logDet;
}

/**
 * Computes the exact (unregularised) log(|X'X|) via Cholesky decomposition.
 * Returns `null` when X has fewer rows than columns (N < p) or is rank-deficient (singular).
 */
export function computeExactLogDetXtX(X: number[][]): number | null {
  const n = X.length;
  if (n === 0) return null;
  const p = X[0].length;
  if (p === 0 || n < p) return null;

  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let r = 0; r < n; r++) {
    const row = X[r];
    for (let i = 0; i < p; i++) {
      const xi = row[i];
      for (let j = i; j < p; j++) {
        XtX[i][j] += xi * row[j];
      }
    }
  }
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < i; j++) {
      XtX[i][j] = XtX[j][i];
    }
  }

  const L: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  let logDet = 0;

  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = XtX[i][j];
      for (let k = 0; k < j; k++) {
        sum -= L[i][k] * L[j][k];
      }
      if (i === j) {
        if (!Number.isFinite(sum) || sum <= 1e-10) {
          return null;
        }
        L[i][j] = Math.sqrt(sum);
        logDet += 2 * Math.log(L[i][j]);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }

  return Number.isFinite(logDet) ? logDet : null;
}

/**
 * Computes standard D-efficiency on the coded [-1, +1] scale for a stated model matrix X (P1.18 / DES-5, MCP-13):
 *   D_eff = 100 * |X'X|^(1/p) / N
 * Returns `null` ("not estimable") for singular designs (N < p or rank(X) < p).
 * Never exceeds 100, and never applies an artificial floor (such as 25) or fallback (such as 95).
 */
export function computeDEfficiency(X: number[][]): number | null {
  const n = X.length;
  if (n === 0) return null;
  const p = X[0].length;
  if (p === 0 || n < p) return null;

  const logDet = computeExactLogDetXtX(X);
  if (logDet === null) return null;

  // |X'X|^(1/p) / N = exp(log(|X'X|) / p) / N
  const rawPct = (Math.exp(logDet / p) / n) * 100;
  if (!Number.isFinite(rawPct) || rawPct <= 0) return null;

  // Guard against floating-point rounding slightly above 100.0 on orthogonal designs
  const bounded = Math.min(100, rawPct);
  return Number(bounded.toFixed(2));
}

export interface DOptimalResult {
  selectedIndices: number[];
  selectedRuns: Record<string, string | number>[];
  /** Standard D-efficiency in [0, 100] on the coded scale, or `null` when singular / not estimable. */
  dEfficiency: number | null;
  modelTermsCount: number;
  warning?: string;
}

function isFactorArray(arr: readonly any[]): arr is Factor[] {
  if (arr.length === 0) return false;
  const first = arr[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    typeof first.id === 'string' &&
    typeof first.name === 'string' &&
    (first.type === 'numeric' || first.type === 'categorical') &&
    typeof first.min === 'number' &&
    typeof first.max === 'number'
  );
}

/**
 * Selects an exact N-run D-optimal subset from a candidate set using
 * Greedy Sequential Augmentation + Fedorov Point-Exchange.
 * Supports both `(candidateRuns, factors, targetRuns)` and `(factors, candidateRuns, targetRuns)`.
 */
export function generateDOptimalSubset(
  firstArg: Factor[] | Record<string, string | number>[],
  secondArg: Record<string, string | number>[] | Factor[],
  targetRuns: number,
  includeInteractionsOverride?: boolean
): DOptimalResult {
  let factors: Factor[];
  let candidates: Record<string, string | number>[];
  if (isFactorArray(firstArg)) {
    factors = firstArg;
    candidates = secondArg as Record<string, string | number>[];
  } else {
    candidates = firstArg as Record<string, string | number>[];
    factors = secondArg as Factor[];
  }

  if (candidates.length === 0 || factors.length === 0) {
    return { selectedIndices: [], selectedRuns: [], dEfficiency: null, modelTermsCount: 1 };
  }

  // Determine how many main-effect parameters exist
  let pMain = 1; // Intercept
  for (const f of factors) {
    if (f.type === 'categorical') {
      const L = f.levels && f.levels.length > 0 ? f.levels.length : 2;
      pMain += Math.max(1, L - 1);
    } else {
      pMain += 1;
    }
  }

  // Determine whether the requested run count was explicitly below pMain
  const requestedN = Math.floor(targetRuns);
  let N: number;
  let underspecifiedWarning: string | undefined;
  if (requestedN <= 0) {
    N = pMain;
  } else if (requestedN < pMain) {
    N = requestedN;
    underspecifiedWarning = `Requested ${requestedN} runs is fewer than the ${pMain} main-effect parameters; the design is singular (D-efficiency not estimable).`;
  } else {
    N = requestedN;
  }

  // Detect whether candidates include 3+ distinct levels for numeric factors (RSM / quadratic candidate grid)
  const numericFactors = factors.filter(f => f.type === 'numeric');
  const hasThreeLevelNumeric =
    numericFactors.length > 0 &&
    numericFactors.some(f => {
      const distinct = new Set<number>();
      for (const c of candidates) {
        const v = Number(c[f.id]);
        if (Number.isFinite(v)) distinct.add(Math.round(v * 1e6) / 1e6);
        if (distinct.size >= 3) return true;
      }
      return false;
    });
  const pQuad = hasThreeLevelNumeric ? numericFactors.length : 0;
  const includeQuadratics = hasThreeLevelNumeric && N >= pMain + pQuad;

  // Include 2FI terms in the optimality criterion only when N is large enough to support them
  const rowWithInt = buildCodedModelRow(factors, candidates[0], true, includeQuadratics);
  const pFull = rowWithInt.length;
  const includeInteractions =
    includeInteractionsOverride !== undefined
      ? includeInteractionsOverride
      : N >= pFull;

  const candidateRows = candidates.map(pt =>
    buildCodedModelRow(factors, pt, includeInteractions, includeQuadratics)
  );
  const p = candidateRows[0].length;
  const M = candidates.length;

  // If N >= M, take all candidates (plus repeats if N > M) and compute actual D-efficiency
  if (N >= M) {
    const selectedIndices: number[] = [];
    for (let i = 0; i < N; i++) {
      selectedIndices.push(i % M);
    }
    const chosenX = selectedIndices.map(idx => candidateRows[idx]);
    return {
      selectedIndices,
      selectedRuns: selectedIndices.map(idx => candidates[idx]),
      dEfficiency: computeDEfficiency(chosenX),
      modelTermsCount: p,
      warning: underspecifiedWarning,
    };
  }

  // Step 1: Greedy sequential initialization starting from most extreme corner point
  const selectedIndices: number[] = [0];
  const usedSet = new Set<number>([0]);

  while (selectedIndices.length < N) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    const currentMatrix = selectedIndices.map(idx => candidateRows[idx]);

    // Use a slightly larger ridge while n < p so greedy initialization prefers orthogonal directions
    const ridge = selectedIndices.length + 1 < p ? 1e-2 : 1e-6;

    for (let c = 0; c < M; c++) {
      if (usedSet.has(c) && M >= N) continue;
      currentMatrix.push(candidateRows[c]);
      const score = computeLogDetXtX(currentMatrix, ridge);
      currentMatrix.pop();

      if (score > bestScore) {
        bestScore = score;
        bestIdx = c;
      }
    }

    if (bestIdx === -1) bestIdx = selectedIndices.length % M;
    selectedIndices.push(bestIdx);
    usedSet.add(bestIdx);
  }

  // Step 2: Fedorov single-point coordinate exchange refinement (up to 15 passes)
  const exchangeRidge = N < p ? 1e-3 : 1e-6;
  let currentScore = computeLogDetXtX(selectedIndices.map(idx => candidateRows[idx]), exchangeRidge);

  for (let pass = 0; pass < 15; pass++) {
    let improved = false;

    for (let i = 0; i < N; i++) {
      const originalIdx = selectedIndices[i];
      let bestReplacement = originalIdx;
      let bestPassScore = currentScore;

      for (let c = 0; c < M; c++) {
        if (c === originalIdx) continue;
        if (selectedIndices.includes(c) && M >= N) continue;

        selectedIndices[i] = c;
        const trialMatrix = selectedIndices.map(idx => candidateRows[idx]);
        const score = computeLogDetXtX(trialMatrix, exchangeRidge);

        if (score > bestPassScore + 1e-7) {
          bestPassScore = score;
          bestReplacement = c;
        }
      }

      selectedIndices[i] = bestReplacement;
      if (bestReplacement !== originalIdx) {
        currentScore = bestPassScore;
        improved = true;
      }
    }

    if (!improved) break;
  }

  const chosenX = selectedIndices.map(idx => candidateRows[idx]);
  const dEff = computeDEfficiency(chosenX);

  return {
    selectedIndices,
    selectedRuns: selectedIndices.map(idx => candidates[idx]),
    dEfficiency: dEff,
    modelTermsCount: p,
    warning: underspecifiedWarning,
  };
}
