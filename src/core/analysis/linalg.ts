import jstat from 'jstat';

const jStat = (jstat as any).default || jstat;

export const ALIAS_TOL = 1e-9;

export interface OlsSolution {
  beta: number[];
  diagInv: number[];
  invXtX: number[][];
  aliased: boolean[];
  rank: number;
  kept: number[];
}

export interface LenthResult {
  contrasts: Record<string, number>;
  s0: number;
  PSE: number;
  df: number;
  ME: number;
  SME: number;
  t: Record<string, number>;
}

/**
 * Standard statistical median (averages the two middle values when the length is even).
 */
export function exactMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Lenth (1989), Technometrics 31:469-473: PSE, ME, SME and t-ratios for a set of 1-df contrasts (2β scale).
 */
export function computeLenth(contrasts: Record<string, number>): LenthResult {
  const entries = Object.entries(contrasts);
  const absVals = entries.map(([, v]) => Math.abs(v));
  const m = absVals.length;
  if (m === 0) {
    return { contrasts, s0: 0, PSE: 0, df: 0, ME: 0, SME: 0, t: {} };
  }
  const s0 = 1.5 * exactMedian(absVals);
  const retained = absVals.filter(v => v < 2.5 * s0);
  const PSE = 1.5 * exactMedian(retained.length > 0 ? retained : absVals);
  const df = m / 3;
  const gamma = (1 + Math.pow(0.95, 1 / m)) / 2;
  const ME = df > 0 && PSE > 0 ? Math.abs(jStat.studentt.inv(0.975, df)) * PSE : 0;
  const SME = df > 0 && PSE > 0 ? Math.abs(jStat.studentt.inv(gamma, df)) * PSE : 0;
  const t: Record<string, number> = {};
  for (const [k, v] of entries) {
    t[k] = PSE > 0 ? Math.abs(v) / PSE : 0;
  }
  return { contrasts, s0, PSE, df, ME, SME, t };
}

/**
 * Solves Ordinary Least Squares via sequential two-pass Gram-Schmidt QR on X.
 * Columns are processed in model order; a column whose residual Euclidean norm
 * is <= ALIAS_TOL * max(1, ||col||_2) is marked aliased.
 * Returns beta, diagInv, invXtX = (X_S' X_S)^-1 mapped to the full index space,
 * aliased flags, rank, and the indices of kept estimable columns.
 */
export function solveOLS(X: number[][], Y: number[][]): OlsSolution {
  const n = X.length;
  const k = n > 0 && X[0] ? X[0].length : 0;
  if (n === 0 || k === 0) {
    return { beta: [], diagInv: [], invXtX: [], aliased: [], rank: 0, kept: [] };
  }

  const Q: number[][] = []; // kept orthonormal columns, each of length n
  const R: number[][] = []; // upper-triangular R_S (rank x rank), stored by column
  const kept: number[] = [];
  const aliased: boolean[] = new Array(k).fill(false);

  for (let j = 0; j < k; j++) {
    const v = new Array<number>(n);
    let colNormSq = 0;
    for (let r = 0; r < n; r++) {
      const val = X[r][j];
      v[r] = val;
      colNormSq += val * val;
    }
    const colNorm = Math.sqrt(colNormSq);
    const tol = ALIAS_TOL * Math.max(1.0, colNorm);

    const m = Q.length;
    const rCol = new Array<number>(m).fill(0);

    // Two-pass Classical Gram-Schmidt (CGS2) for full numerical orthogonality
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < m; i++) {
        const qi = Q[i];
        let dot = 0;
        for (let r = 0; r < n; r++) {
          dot += qi[r] * v[r];
        }
        rCol[i] += dot;
        for (let r = 0; r < n; r++) {
          v[r] -= dot * qi[r];
        }
      }
    }

    let residNormSq = 0;
    for (let r = 0; r < n; r++) {
      residNormSq += v[r] * v[r];
    }
    const residNorm = Math.sqrt(residNormSq);

    if (residNorm <= tol) {
      aliased[j] = true;
    } else {
      aliased[j] = false;
      kept.push(j);
      const qNew = new Array<number>(n);
      for (let r = 0; r < n; r++) {
        qNew[r] = v[r] / residNorm;
      }
      Q.push(qNew);
      rCol.push(residNorm);
      R.push(rCol);
    }
  }

  const rank = kept.length;
  // Convert column-stored R into rank x rank row-major upper triangular matrix RMat
  const RMat: number[][] = Array.from({ length: rank }, () => new Array<number>(rank).fill(0));
  for (let col = 0; col < rank; col++) {
    const rCol = R[col];
    for (let row = 0; row <= col; row++) {
      RMat[row][col] = rCol[row];
    }
  }

  // Compute z = Q_S^T * Y
  const z = new Array<number>(rank).fill(0);
  for (let i = 0; i < rank; i++) {
    const qi = Q[i];
    let sum = 0;
    for (let r = 0; r < n; r++) {
      sum += qi[r] * (Y[r]?.[0] ?? 0);
    }
    z[i] = sum;
  }

  // Back-substitution for R_S * beta_S = z
  const betaS = new Array<number>(rank).fill(0);
  for (let i = rank - 1; i >= 0; i--) {
    let sum = z[i];
    for (let u = i + 1; u < rank; u++) {
      sum -= RMat[i][u] * betaS[u];
    }
    betaS[i] = sum / RMat[i][i];
  }

  // Compute R_S^-1 (rank x rank upper triangular)
  const RInv: number[][] = Array.from({ length: rank }, () => new Array<number>(rank).fill(0));
  for (let j = 0; j < rank; j++) {
    RInv[j][j] = 1.0 / RMat[j][j];
    for (let i = j - 1; i >= 0; i--) {
      let sum = 0;
      for (let u = i + 1; u <= j; u++) {
        sum += RMat[i][u] * RInv[u][j];
      }
      RInv[i][j] = -sum / RMat[i][i];
    }
  }

  // Compute (X_S' X_S)^-1 = R_S^-1 * (R_S^-1)^T and map to full k x k space
  const beta = new Array<number>(k).fill(0);
  const diagInv = new Array<number>(k).fill(0);
  const invXtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));

  for (let a = 0; a < rank; a++) {
    const colA = kept[a];
    beta[colA] = betaS[a];
    for (let b = a; b < rank; b++) {
      const colB = kept[b];
      const uStart = b; // max(a, b) since b >= a
      let sum = 0;
      for (let u = uStart; u < rank; u++) {
        sum += RInv[a][u] * RInv[b][u];
      }
      invXtX[colA][colB] = sum;
      invXtX[colB][colA] = sum;
      if (a === b) {
        diagInv[colA] = sum;
      }
    }
  }

  return { beta, diagInv, invXtX, aliased, rank, kept };
}
