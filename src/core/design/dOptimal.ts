import jstat from 'jstat';
const jStat = (jstat as any).default || jstat;
import { Factor } from '../types';
import { getFactorContrasts } from '../analysis/analysisCore';

/**
 * Builds the linear model contrast row for a candidate setting combination
 */
export function buildCandidateRow(
  factors: Factor[],
  factorSettings: Record<string, any>,
  includeInteractions: boolean = false
): number[] {
  const row: number[] = [1]; // Intercept

  const factorContrastsList: number[][] = [];
  factors.forEach(f => {
    const rawVal = factorSettings[f.id];
    const contrasts = getFactorContrasts(f, rawVal);
    factorContrastsList.push(contrasts);
    for (let c = 0; c < contrasts.length; c++) {
      row.push(contrasts[c]);
    }
  });

  if (includeInteractions) {
    const k = factors.length;
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const c1 = factorContrastsList[i];
        const c2 = factorContrastsList[j];
        for (let p = 0; p < c1.length; p++) {
          for (let q = 0; q < c2.length; q++) {
            row.push(c1[p] * c2[q]);
          }
        }
      }
    }
  }

  return row;
}

/**
 * Computes log-determinant of X^T X with ridge regularization for numerical stability
 */
export function computeLogDetXtX(X: number[][]): number {
  if (X.length === 0 || X[0].length === 0) return -1e9;
  const n = X.length;
  const p = X[0].length;
  if (n < p) return -1e9;

  // Compute XtX = X^T * X
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let r = 0; r < n; r++) {
    const row = X[r];
    for (let i = 0; i < p; i++) {
      const xi = row[i];
      if (xi === 0) continue;
      for (let j = i; j < p; j++) {
        XtX[i][j] += xi * row[j];
      }
    }
  }
  // Fill lower symmetric
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < i; j++) {
      XtX[i][j] = XtX[j][i];
    }
  }

  // Slight ridge for numerical stability
  for (let i = 0; i < p; i++) {
    XtX[i][i] += 1e-4;
  }

  // Cholesky decomposition L * L^T for O(p^3) fast and exact log-det
  const L: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  let logDet = 0;

  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = XtX[i][i] - sum;
        if (val <= 1e-9) return -1e9; // Singular / non-positive-definite
        const diag = Math.sqrt(val);
        L[i][i] = diag;
        logDet += 2 * Math.log(diag);
      } else {
        const lj = L[j][j];
        if (lj <= 1e-9) return -1e9;
        L[i][j] = (XtX[i][j] - sum) / lj;
      }
    }
  }

  return isNaN(logDet) ? -1e9 : logDet;
}

/**
 * Generates a D-Optimal subset of runs from the full Cartesian candidate grid.
 * Adapts model complexity based on run budget and uses coordinate exchange.
 */
export function generateDOptimalSubset(
  allCandidateRuns: Record<string, string | number>[],
  factors: Factor[],
  targetRuns: number
): { selectedIndices: number[]; dEfficiency: number } {
  const M = allCandidateRuns.length;
  const N = Math.min(M, Math.max(factors.length + 1, targetRuns));

  if (N >= M) {
    return {
      selectedIndices: Array.from({ length: M }, (_, i) => i),
      dEfficiency: 100
    };
  }

  // Calculate parameters for main effects model
  let pMain = 1;
  factors.forEach(f => {
    pMain += f.type === 'categorical' && f.levels ? Math.max(1, f.levels.length - 1) : 1;
  });

  // Calculate parameters with interactions
  let pInt = 0;
  for (let i = 0; i < factors.length; i++) {
    const df1 = factors[i].type === 'categorical' && factors[i].levels ? Math.max(1, factors[i].levels!.length - 1) : 1;
    for (let j = i + 1; j < factors.length; j++) {
      const df2 = factors[j].type === 'categorical' && factors[j].levels ? Math.max(1, factors[j].levels!.length - 1) : 1;
      pInt += df1 * df2;
    }
  }

  const includeInteractions = N >= pMain + pInt + 2;

  // Precompute candidate rows
  const candidateRows: number[][] = allCandidateRuns.map(settings =>
    buildCandidateRow(factors, settings, includeInteractions)
  );

  // Initial stratified / spread selection
  const selected = new Set<number>();
  const step = M / N;
  for (let i = 0; i < N; i++) {
    const idx = Math.min(M - 1, Math.floor(i * step));
    selected.add(idx);
  }
  let fillIdx = 0;
  while (selected.size < N && fillIdx < M) {
    selected.add(fillIdx);
    fillIdx++;
  }

  let currentIndices = Array.from(selected);
  let currentX = currentIndices.map(i => candidateRows[i]);
  let currentScore = computeLogDetXtX(currentX);

  // Exchange passes (up to 3 passes for near-instant execution)
  const maxPasses = 3;
  for (let pass = 0; pass < maxPasses; pass++) {
    let passImproved = false;

    for (let pos = 0; pos < N; pos++) {
      const oldIdx = currentIndices[pos];
      let bestCandidateIdx = oldIdx;
      let bestCandidateScore = currentScore;

      for (let c = 0; c < M; c++) {
        if (selected.has(c)) continue;

        currentIndices[pos] = c;
        const testX = currentIndices.map(i => candidateRows[i]);
        const testScore = computeLogDetXtX(testX);

        if (testScore > bestCandidateScore + 1e-4) {
          bestCandidateScore = testScore;
          bestCandidateIdx = c;
          passImproved = true;
        }
      }

      if (bestCandidateIdx !== oldIdx) {
        selected.delete(oldIdx);
        selected.add(bestCandidateIdx);
        currentIndices[pos] = bestCandidateIdx;
        currentScore = bestCandidateScore;
      } else {
        currentIndices[pos] = oldIdx;
      }
    }

    if (!passImproved) break;
  }

  // Calculate approximate D-efficiency
  const fullLogDet = computeLogDetXtX(candidateRows);
  const p = candidateRows[0].length;
  let dEff = 95;
  if (fullLogDet > -1e8 && currentScore > -1e8 && p > 0) {
    const logRatio = (currentScore - fullLogDet) / p - Math.log(N / M);
    dEff = Math.min(100, Math.max(25, Math.round(Math.exp(logRatio) * 100)));
  }

  return {
    selectedIndices: currentIndices.sort((a, b) => a - b),
    dEfficiency: dEff
  };
}
