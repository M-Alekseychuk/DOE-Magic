import jstat from 'jstat';
const jStat = (jstat as any).default || jstat;
import { Project, Response, Factor } from '../types';

function normSInv(p: number): number {
  if (p >= 1) return 3.5;
  if (p <= 0) return -3.5;
  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;
  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;
  const c1 = -0.00778489400243029;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;
  const d1 = 0.00778469570904146;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  let q, r, x;

  if (p < 0.02425) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
          ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= 0.97575) {
      q = p - 0.5;
      r = q * q;
      x = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
          (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
          ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }

  return x;
}

/**
 * Computes contrast values for a factor setting.
 * - Numeric factors: coded into [-1, +1] based on (min + max)/2 and range.
 * - 2-level categorical: [-1] for level 0, [+1] for level 1.
 * - L >= 3 categorical: sum-to-zero contrasts (L-1 columns):
 *   Level j (0 <= j < L - 1): +1 for column j, 0 elsewhere.
 *   Level L - 1 (reference): -1 across all L - 1 columns.
 */
export function getFactorContrasts(factor: Factor, runVal: any): number[] {
  if (factor.type === 'categorical') {
    const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
    const L = levels.length;
    const strVal = String(runVal ?? '').trim().toLowerCase();
    let idx = levels.findIndex(l => l.trim().toLowerCase() === strVal);
    if (idx === -1) {
      const n = Number(runVal);
      if (!isNaN(n) && n >= 0 && n < L) idx = Math.floor(n);
      else idx = 0;
    }

    if (L <= 2) {
      return [idx === 1 ? 1 : -1];
    } else {
      const contrasts = new Array(L - 1).fill(0);
      if (idx === L - 1) {
        contrasts.fill(-1);
      } else if (idx >= 0 && idx < L - 1) {
        contrasts[idx] = 1;
      }
      return contrasts;
    }
  } else {
    const num = Number(runVal);
    const mid = (factor.min + factor.max) / 2;
    const range = (factor.max - factor.min) || 1;
    const val = isNaN(num) ? 0 : 2 * (num - mid) / range;
    return [Math.max(-2, Math.min(2, val))];
  }
}

// Matrix math utilities for OLS
function transpose(m: number[][]) {
    return m[0].map((_, i) => m.map(row => row[i]));
}

function multiply(m1: number[][], m2: number[][]) {
    const res = Array(m1.length).fill(0).map(() => Array(m2[0].length).fill(0));
    for (let i = 0; i < m1.length; i++) {
        for (let j = 0; j < m2[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < m1[0].length; k++) {
                sum += m1[i][k] * m2[k][j];
            }
            res[i][j] = sum;
        }
    }
    return res;
}

function solveOLS(X: number[][], Y: number[][]) {
    const n = X.length;
    const k = X[0].length;
    
    const Xt = transpose(X);
    const XtX = multiply(Xt, X);
    const XtY = multiply(Xt, Y);
    
    const aug: number[][] = [];
    for (let i = 0; i < k; i++) {
        const row = [...XtX[i], XtY[i][0]];
        for (let j = 0; j < k; j++) row.push(i === j ? 1 : 0);
        aug.push(row);
    }
    
    const aliased = new Array(k).fill(false);
    let currentRow = 0;
    const colToRow = new Array(k).fill(-1);
    
    for (let col = 0; col < k; col++) {
        let pivotRow = currentRow;
        let maxVal = 0;
        for (let r = currentRow; r < k; r++) {
            if (Math.abs(aug[r][col]) > maxVal) {
                maxVal = Math.abs(aug[r][col]);
                pivotRow = r;
            }
        }
        
        if (maxVal < 1e-9) {
            aliased[col] = true;
            continue;
        }
        
        const pivotVal = aug[pivotRow][col];
        const temp = aug[currentRow];
        aug[currentRow] = aug[pivotRow];
        aug[pivotRow] = temp;
        
        for (let j = col; j < k + 1 + k; j++) {
            aug[currentRow][j] /= pivotVal;
        }
        
        for (let r = 0; r < k; r++) {
            if (r !== currentRow) {
                const factor = aug[r][col];
                for (let j = col; j < k + 1 + k; j++) {
                    aug[r][j] -= factor * aug[currentRow][j];
                }
            }
        }
        
        colToRow[col] = currentRow;
        currentRow++;
    }
    
    const rank = currentRow;
    const beta = new Array(k).fill(0);
    const diagInv = new Array(k).fill(0);
    const invXtX = Array(k).fill(0).map(() => Array(k).fill(0));
    
    for (let col = 0; col < k; col++) {
        if (!aliased[col]) {
            const r = colToRow[col];
            beta[col] = aug[r][k];
            diagInv[col] = Math.max(0, aug[r][k + 1 + col]);
            for (let c2 = 0; c2 < k; c2++) {
                if (!aliased[c2]) {
                    invXtX[col][c2] = aug[r][k + 1 + c2];
                }
            }
        }
    }
    
    return { beta, diagInv, invXtX, aliased, rank };
}

export function computeAnalysis(project: Project, activeResponse: Response, excludedTerms: string[], effectiveGoal: string | undefined, effectiveTargetValue: number | undefined) {
    const hasData = project.runs.length > 0 && project.factors.length > 0;

    if (!hasData || !activeResponse) return null;

    const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && String(r.responses[activeResponse.id]) !== '');
    if (validRuns.length === 0) return null;

    const k = project.factors.length;
    const nRuns = validRuns.length;
    const overallMean = validRuns.reduce((sum, r) => sum + Number(r.responses[activeResponse.id]), 0) / validRuns.length;

    // 1. Build Design Matrix X and Response Vector Y for OLS
    
    // 1. Build Model Effects (Main Effects and 2-Factor Interactions)
    interface ModelEffect {
      id: string;
      name: string;
      type: 'main' | 'interaction';
      factor?: Factor;
      f1?: Factor;
      f2?: Factor;
      df: number;
      columnNames: string[];
      cleanNames: string[];
      getContrasts: (factorsRecord: Record<string, any>) => number[];
      isExcluded: boolean;
      colIndices: number[]; // Column indices in X (1-based, after intercept 0)
    }

    const allEffects: ModelEffect[] = [];

    // Main factors
    project.factors.forEach(f => {
      const isExcluded = excludedTerms.includes(f.id);
      if (f.type === 'categorical') {
        const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        const L = levels.length;
        if (L <= 2) {
          const colName = `${f.name}[${levels[1]}]`;
          allEffects.push({
            id: f.id,
            name: f.name,
            type: 'main',
            factor: f,
            df: 1,
            columnNames: [colName],
            cleanNames: [colName],
            getContrasts: (rec) => getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]),
            isExcluded,
            colIndices: []
          });
        } else {
          const columnNames: string[] = [];
          for (let j = 0; j < L - 1; j++) {
            columnNames.push(`${f.name}[${levels[j]}]`);
          }
          allEffects.push({
            id: f.id,
            name: f.name,
            type: 'main',
            factor: f,
            df: L - 1,
            columnNames,
            cleanNames: [...columnNames],
            getContrasts: (rec) => getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]),
            isExcluded,
            colIndices: []
          });
        }
      } else {
        const colName = `${f.name}`;
        allEffects.push({
          id: f.id,
          name: f.name,
          type: 'main',
          factor: f,
          df: 1,
          columnNames: [colName],
          cleanNames: [f.name],
          getContrasts: (rec) => getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]),
          isExcluded,
          colIndices: []
        });
      }
    });

    // 2-factor interactions
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const f1 = project.factors[i];
        const f2 = project.factors[j];
        const intId = `${f1.id}*${f2.id}`;
        const isExcluded = excludedTerms.includes(intId);
        
        const e1 = allEffects.find(e => e.type === 'main' && e.id === f1.id)!;
        const e2 = allEffects.find(e => e.type === 'main' && e.id === f2.id)!;
        const intDf = e1.df * e2.df;
        const columnNames: string[] = [];
        const cleanNames: string[] = [];

        e1.columnNames.forEach(c1 => {
          e2.columnNames.forEach(c2 => {
            const name = `${c1}*${c2}`;
            columnNames.push(name);
            cleanNames.push(name);
          });
        });

        allEffects.push({
          id: intId,
          name: `${f1.name}*${f2.name}`,
          type: 'interaction',
          f1,
          f2,
          df: intDf,
          columnNames,
          cleanNames,
          getContrasts: (rec) => {
            const c1 = e1.getContrasts(rec);
            const c2 = e2.getContrasts(rec);
            const res: number[] = [];
            for (let p = 0; p < c1.length; p++) {
              for (let q = 0; q < c2.length; q++) {
                res.push(c1[p] * c2[q]);
              }
            }
            return res;
          },
          isExcluded,
          colIndices: []
        });
      }
    }

    // Assign column indices for active effects
    const activeEffects = allEffects.filter(e => !e.isExcluded);
    let currentCol = 1;
    activeEffects.forEach(e => {
      e.colIndices = [];
      for (let c = 0; c < e.df; c++) {
        e.colIndices.push(currentCol++);
      }
    });

    const numTerms = currentCol;

    // Build Design Matrix X and Response Vector Y for OLS
    const X: number[][] = [];
    const Y: number[][] = [];

    validRuns.forEach(run => {
      const res = Number(run.responses[activeResponse.id]);
      Y.push([res]);

      const row = [1]; // Intercept
      activeEffects.forEach(e => {
        const contrasts = e.getContrasts(run.factors);
        for (let c = 0; c < contrasts.length; c++) {
          row.push(contrasts[c]);
        }
      });
      X.push(row);
    });

    // 2. Perform Robust OLS solving
    const { beta, diagInv, invXtX, aliased, rank } = solveOLS(X, Y);

    // 3. Map Effects & Level Averages for UI (Pareto, Main Effects, Half-Normal)
    const effects: any[] = [];
    const interactions: any[] = [];

    project.factors.forEach(factor => {
      const e = allEffects.find(eff => eff.type === 'main' && eff.id === factor.id)!;
      const isAliased = e.colIndices.some(c => aliased[c]);
      const isExcluded = e.isExcluded;
      const betaIdx = e.colIndices.length > 0 ? e.colIndices[0] : -1;

      if (factor.type === 'categorical') {
        const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
        const levelAverages = levels.map(lvl => {
          const matching = validRuns.filter(r => String(r.factors[factor.id] ?? '').trim().toLowerCase() === lvl.trim().toLowerCase());
          const count = matching.length;
          const avg = count > 0 ? matching.reduce((s, r) => s + Number(r.responses[activeResponse.id]), 0) / count : 0;
          return { level: lvl, avg, count };
        });

        const avgs = levelAverages.map(l => l.avg);
        const lowAvg = avgs.length > 0 ? Math.min(...avgs) : 0;
        const highAvg = avgs.length > 0 ? Math.max(...avgs) : 0;
        const effectVal = highAvg - lowAvg;

        effects.push({
          factor,
          effect: effectVal,
          absEffect: Math.abs(effectVal),
          direction: 'Neutral',
          lowAvg,
          highAvg,
          levelAverages,
          highCount: validRuns.length,
          lowCount: 0,
          betaIdx,
          isAliased,
          isExcluded,
          id: factor.id
        });
      } else {
        let effectVal = 0;
        if (!isExcluded && betaIdx !== -1) {
          effectVal = beta[betaIdx] * 2;
        }

        let highSum = 0, highCount = 0;
        let lowSum = 0, lowCount = 0;
        let centerSum = 0, centerCount = 0;
        const mid = (factor.min + factor.max) / 2;
        const halfRange = Math.abs(factor.max - factor.min) / 2;

        validRuns.forEach(r => {
          const v = Number(r.factors[factor.id]);
          const resp = Number(r.responses[activeResponse.id]);
          if (halfRange > 1e-9 && Math.abs(v - mid) <= halfRange * 0.15) {
            centerSum += resp; centerCount++;
          } else if (v > mid + 1e-6) {
            highSum += resp; highCount++;
          } else if (v < mid - 1e-6) {
            lowSum += resp; lowCount++;
          }
        });

        effects.push({
          factor,
          effect: effectVal,
          absEffect: Math.abs(effectVal),
          direction: effectVal >= 0 ? 'Positive' : 'Negative',
          lowAvg: lowCount > 0 ? lowSum / lowCount : 0,
          highAvg: highCount > 0 ? highSum / highCount : 0,
          centerAvg: centerCount > 0 ? centerSum / centerCount : null,
          highCount, lowCount, betaIdx, isAliased, isExcluded, id: factor.id
        });
      }
    });

    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const intId = `${project.factors[i].id}*${project.factors[j].id}`;
        const e = allEffects.find(eff => eff.type === 'interaction' && eff.id === intId)!;
        const isAliased = e.colIndices.some(c => aliased[c]);
        const isExcluded = e.isExcluded;
        const betaIdx = e.colIndices.length > 0 ? e.colIndices[0] : -1;
        const effectVal = !isExcluded && betaIdx !== -1 ? beta[betaIdx] * 2 : 0;

        interactions.push({
          f1: project.factors[i],
          f2: project.factors[j],
          id: intId,
          effect: effectVal,
          absEffect: Math.abs(effectVal),
          direction: effectVal >= 0 ? 'Positive' : 'Negative',
          betaIdx,
          isAliased,
          isExcluded
        });
      }
    }

    // 4. Calculate SSE, SST, and R-squared based on the exact OLS model

    let sse = 0;
    let sst = 0;
    validRuns.forEach((run, idx) => {
        const actual = Y[idx][0];
        sst += Math.pow(actual - overallMean, 2);
        
        let pred = 0;
        for (let i = 0; i < numTerms; i++) {
            pred += beta[i] * X[idx][i];
        }
        sse += Math.pow(actual - pred, 2);
    });

    const p_model = rank - 1; // parameters excluding intercept
    const df_error = Math.max(0, nRuns - rank);
    const mse = df_error > 0 ? sse / df_error : 0;
    
    const ss_model = Math.max(0, sst - sse);
    const ms_model = p_model > 0 ? ss_model / p_model : 0;
    const f_model = mse > 0 ? ms_model / mse : 0;
    
    const rSquared = sst > 0 ? 1 - (sse / sst) : 0;
    let adjRSquared = 0;
    if (df_error > 0 && sst > 0 && nRuns > 1) {
        adjRSquared = 1 - (1 - rSquared) * ((nRuns - 1) / df_error);
    }

    // 5. Lack Of Fit and Pure Error
    const runGroups: Record<string, number[]> = {};
    
    // Determine which factors are active in the model
    const activeFactorIds = new Set<string>();
    activeEffects.forEach(t => {
      if (t.type === 'main' && t.factor) activeFactorIds.add(t.factor.id);
      if (t.type === 'interaction' && t.f1 && t.f2) {
        activeFactorIds.add(t.f1.id);
        activeFactorIds.add(t.f2.id);
      }
    });

    validRuns.forEach(run => {
      const key = project.factors
        .filter(f => activeFactorIds.has(f.id))
        .map(f => f.type === 'categorical' ? String(run.factors[f.id] ?? '').trim().toLowerCase() : (Number.isFinite(Number(run.factors[f.id])) ? Number(run.factors[f.id]).toFixed(6) : '0.000000'))
        .join(',');
      
      // If there are NO active factors (e.g. only intercept), all runs are grouped together
      const finalKey = key || 'intercept_only';
      
      if (!runGroups[finalKey]) runGroups[finalKey] = [];
      runGroups[finalKey].push(Number(run.responses[activeResponse.id]));
    });

    let ss_pure = 0;
    let df_pure = 0;
    
    Object.values(runGroups).forEach(group => {
      if (group.length > 1) {
        const mean = group.reduce((a, b) => a + b, 0) / group.length;
        ss_pure += group.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        df_pure += group.length - 1;
      }
    });

    // df_lof = Error DF - Pure Error DF
    const df_lof = Math.max(0, df_error - df_pure);
    const ss_lof = Math.max(0, sse - ss_pure);

    const ms_lof = df_lof > 0 ? ss_lof / df_lof : 0;
    const ms_pure = df_pure > 0 ? ss_pure / df_pure : 0;
    const f_lof = ms_pure > 0 ? ms_lof / ms_pure : (ms_lof > 0 ? Infinity : 0);
    
    let p_lof = null;
    if (df_lof > 0 && df_pure > 0 && ms_pure > 0 && f_lof > 0) {
      p_lof = 1 - jStat.centralF.cdf(f_lof, df_lof, df_pure);
    }

    const lackOfFit = {
      ss_lof, df_lof, ms_lof, f_lof, p_lof,
      ss_pure, df_pure, ms_pure,
      sse, df_error, sst
    };

    // Determine testing error term for ANOVA
    let test_df = df_error;
    let test_ms = mse;

    // If perfectly saturated model, fall back to pure error (if available) or PSE
    if (test_df <= 0 && df_pure > 0) {
      test_df = df_pure;
      test_ms = ms_pure;
    }

    // Lenth's Pseudo Standard Error (for unreplicated, saturated designs)
    let useLenths = false;
    let paretoThreshold = 0;
    
    const unaliasedEffectsAbs = [
      ...effects.filter(e => !e.isAliased).map(e => e.absEffect), 
      ...interactions.filter(i => !i.isAliased).map(i => i.absEffect)
    ];
    
    const s0 = 1.5 * jStat.median(unaliasedEffectsAbs);
    const retainedEffects = unaliasedEffectsAbs.filter(e => e < 2.5 * s0);
    const pse = 1.5 * jStat.median(retainedEffects);
    
    if (test_df <= 0 || test_ms === 0) {
      useLenths = true;
      test_ms = Math.pow(pse, 2) / (nRuns / 4); // convert PSE to pseudo-MS
      test_df = Math.max(1, Math.floor(unaliasedEffectsAbs.length / 3));
    }
    paretoThreshold = 2.12 * pse;

    // 6. Partial Sum of Squares (Type III ANOVA) for individual terms
    const effectSummary: any[] = [];
    
    allEffects.forEach(effect => {
      let ss = 0;
      let logworth = 0;
      let pVal = 1;
      let fRatio = 0;
      const isAliased = effect.colIndices.some(c => aliased[c]);
      const isExcluded = effect.isExcluded;

      if (isAliased) {
        ss = 0;
        pVal = 1;
      } else if (!isExcluded && effect.colIndices.length > 0) {
        if (effect.df === 1) {
          const betaIdx = effect.colIndices[0];
          if (diagInv[betaIdx] > 0) {
            ss = Math.pow(beta[betaIdx], 2) / diagInv[betaIdx];
          }
        } else {
          // Multi-df term: Type III Partial SS via reduced model
          const reducedColSet = new Set(effect.colIndices);
          const X_red: number[][] = X.map(row => row.filter((_, colIdx) => !reducedColSet.has(colIdx)));
          const redModel = solveOLS(X_red, Y);
          let sse_red = 0;
          for (let r = 0; r < nRuns; r++) {
            let pred_r = 0;
            for (let c = 0; c < X_red[0].length; c++) {
              pred_r += redModel.beta[c] * X_red[r][c];
            }
            sse_red += Math.pow(Y[r][0] - pred_r, 2);
          }
          ss = Math.max(0, sse_red - sse);
        }

        if (test_df > 0 && test_ms > 0) {
          const ms = ss / effect.df;
          fRatio = ms / test_ms;
          pVal = 1 - jStat.centralF.cdf(fRatio, effect.df, test_df);
          if (pVal < 1e-15) pVal = 1e-15;
          logworth = -Math.log10(pVal);
        }
      }

      effectSummary.push({
        name: effect.name + (isAliased && !isExcluded ? " (Aliased)" : ""),
        logworth,
        pVal,
        ss,
        fRatio,
        df: effect.df,
        nparm: effect.df,
        isAliased,
        isExcluded,
        id: effect.id
      });
    });

    effectSummary.sort((a, b) => {
      if (a.isAliased && !b.isAliased) return 1;
      if (!a.isAliased && b.isAliased) return -1;
      return b.logworth - a.logworth;
    });

    // Calculate standard errors and t-Ratios for all terms
    const stdErrors = new Array(numTerms).fill(0);
    const tRatios = new Array(numTerms).fill(0);
    
    for (let i = 0; i < numTerms; i++) {
      if (df_error > 0) {
        stdErrors[i] = Math.sqrt(mse * diagInv[i]);
      } else {
        stdErrors[i] = pse / 2;
      }
      tRatios[i] = stdErrors[i] > 0 ? beta[i] / stdErrors[i] : 0;
    }

    const tLimitPareto = df_error > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / 2, df_error)) : 3;
    
    // 7. Data for Plots (always show all primary and secondary effects; exclude aliased and excluded terms)
    const combinedEffectsForPlot = [
      ...effects.filter(e => !e.isAliased && !e.isExcluded).map(e => {
        const effSummary = effectSummary.find(s => s.id === e.id);
        const tVal = effSummary && effSummary.fRatio > 0 ? Math.sqrt(effSummary.fRatio) : (e.betaIdx >= 0 ? Math.abs(tRatios[e.betaIdx]) : 0);
        return { 
          name: e.factor.name, 
          absEffect: e.absEffect, 
          direction: e.direction, 
          factor: e.factor,
          tRatio: tVal
        };
      }),
      ...interactions.filter(i => !i.isAliased && !i.isExcluded).map(i => {
        const effSummary = effectSummary.find(s => s.id === i.id);
        const tVal = effSummary && effSummary.fRatio > 0 ? Math.sqrt(effSummary.fRatio) : (i.betaIdx >= 0 ? Math.abs(tRatios[i.betaIdx]) : 0);
        return { 
          name: `${i.f1.name}*${i.f2.name}`, 
          absEffect: i.absEffect, 
          direction: i.direction, 
          factor: { name: `${i.f1.name}*${i.f2.name}` },
          tRatio: tVal
        };
      })
    ];

    const sortedForHalfNormal = [...combinedEffectsForPlot].sort((a, b) => a.tRatio - b.tRatio);
    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.tRatio > tLimitPareto };
    });
    
    // Fit a line to the smallest 50% of effects
    let halfNormalSlope = 1;
    const nSmallest = halfNormalData.length > 1 ? Math.max(1, Math.floor(halfNormalData.length * 0.5)) : halfNormalData.length;
    let sumX2 = 0;
    let sumXY = 0;
    for (let i = 0; i < nSmallest; i++) {
      if (halfNormalData[i] && typeof halfNormalData[i].tRatio === 'number') {
        sumX2 += halfNormalData[i].tRatio * halfNormalData[i].tRatio;
        sumXY += halfNormalData[i].tRatio * halfNormalData[i].expected;
      }
    }
    if (sumX2 > 0) {
      halfNormalSlope = sumXY / sumX2;
    }
    const maxT = halfNormalData.length > 0 ? Math.max(...halfNormalData.map(d => d.tRatio)) : 1;
    const halfNormalLine = [
      { x: 0, y: 0 },
      { x: maxT, y: halfNormalSlope * maxT }
    ];

    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.tRatio - a.tRatio);
    const bonferroniLimitPareto = df_error > 0 && activeEffects.length > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / (2 * activeEffects.length), df_error)) : 3.5;

    // 8. Predictive Model Optimization & Statistical Inference
    const buildModelRow = (settingsMap: Record<string, any>) => {
      const row = [1];
      activeEffects.forEach(e => {
        const contrasts = e.getContrasts(settingsMap);
        for (let c = 0; c < contrasts.length; c++) {
          row.push(contrasts[c]);
        }
      });
      return row;
    };

    const predictAtSettings = (settingsMap: Record<string, any>) => {
      const row = buildModelRow(settingsMap);
      let y_hat = 0;
      for (let idx = 0; idx < row.length; idx++) {
        if (!aliased[idx]) {
          y_hat += beta[idx] * row[idx];
        }
      }
      return y_hat;
    };

    // Calculate prediction leverage, standard errors, and confidence intervals
    const getPointStats = (settingsMap: Record<string, any>) => {
      const row = buildModelRow(settingsMap);
      let h00 = 0;
      const numCols = row.length;
      for (let r1 = 0; r1 < numCols; r1++) {
        if (aliased[r1]) continue;
        for (let r2 = 0; r2 < numCols; r2++) {
          if (aliased[r2]) continue;
          h00 += row[r1] * invXtX[r1][r2] * row[r2];
        }
      }
      h00 = Math.max(0, h00);
      const seMean = Math.sqrt(Math.max(0, mse * h00));
      const sePred = Math.sqrt(Math.max(0, mse * (1 + h00)));
      const tCrit = df_error > 0 ? (jStat.studentt.inv(0.975, df_error) || 1.96) : 1.96;
      const y_hat = predictAtSettings(settingsMap);
      return {
        y_hat,
        h00,
        seMean,
        sePred,
        tCrit,
        ciLower: y_hat - tCrit * seMean,
        ciUpper: y_hat + tCrit * seMean,
        piLower: y_hat - tCrit * sePred,
        piUpper: y_hat + tCrit * sePred
      };
    };

    // Standard Derringer-Suich desirability function
    const observedY = validRuns.map(r => Number(r.responses[activeResponse.id]));
    const yMin = Math.min(...observedY);
    const yMax = Math.max(...observedY);
    const ySpan = yMax - yMin > 1e-9 ? yMax - yMin : 1;
    const targetVal = effectiveTargetValue !== undefined && effectiveTargetValue !== null ? effectiveTargetValue : overallMean;

    const calcDesirabilityAndScore = (y_hat: number): { d: number, score: number } => {
      if (effectiveGoal === 'maximize') {
        const upperTarget = effectiveTargetValue !== undefined && effectiveTargetValue !== null ? effectiveTargetValue : yMax;
        const d = upperTarget > yMin ? Math.max(0, Math.min(1, (y_hat - yMin) / (upperTarget - yMin))) : 1;
        const score = d * 1000 + y_hat;
        return { d, score };
      } else if (effectiveGoal === 'minimize') {
        const lowerTarget = effectiveTargetValue !== undefined && effectiveTargetValue !== null ? effectiveTargetValue : yMin;
        const d = yMax > lowerTarget ? Math.max(0, Math.min(1, (yMax - y_hat) / (yMax - lowerTarget))) : 1;
        const score = d * 1000 - y_hat;
        return { d, score };
      } else {
        const tol = ySpan * 0.5;
        const dist = Math.abs(y_hat - targetVal);
        const d = Math.max(0, Math.min(1, 1 - dist / tol));
        const score = d * 1000 - dist;
        return { d, score };
      }
    };

    // Candidate search for optimal factor settings
    const factorCandidateValues: (string | number)[][] = project.factors.map(f => {
      if (f.type === 'categorical') {
        return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
      } else {
        const mid = (f.min + f.max) / 2;
        return [f.min, mid, f.max];
      }
    });

    let bestSettingsMap: Record<string, any> = {};
    let bestScore = -Infinity;
    let bestD = 0;
    let bestPred = overallMean;

    // Evaluate combinations
    let candidateCombinations: Record<string, any>[] = [{}];
    for (let fIdx = 0; fIdx < project.factors.length; fIdx++) {
      const f = project.factors[fIdx];
      const vals = factorCandidateValues[fIdx];
      const nextCombs: Record<string, any>[] = [];
      for (const comb of candidateCombinations) {
        for (const v of vals) {
          nextCombs.push({ ...comb, [f.id]: v });
        }
      }
      candidateCombinations = nextCombs.length > 512 ? nextCombs.slice(0, 512) : nextCombs;
    }

    candidateCombinations.forEach(comb => {
      const y_hat = predictAtSettings(comb);
      const { d, score } = calcDesirabilityAndScore(y_hat);
      if (score > bestScore) {
        bestScore = score;
        bestD = d;
        bestPred = y_hat;
        bestSettingsMap = comb;
      }
    });

    // Statistical inference metrics at optimum
    const optStats = getPointStats(bestSettingsMap);

    const optimalFactors = project.factors.map(f => {
      const val = bestSettingsMap[f.id];
      if (f.type === 'categorical') {
        return {
          factor: f,
          optimalValue: String(val ?? (f.levels ? f.levels[0] : 'Level 1')),
          codedValue: 0,
          codedLabel: String(val ?? (f.levels ? f.levels[0] : 'Level 1')),
          codedSlope: 0,
          naturalSlope: null,
          effectValue: 0
        };
      } else {
        const numVal = Number.isFinite(Number(val)) ? Number(val) : (f.min ?? 0);
        const fMin = typeof f.min === 'number' && Number.isFinite(f.min) ? f.min : 0;
        const fMax = typeof f.max === 'number' && Number.isFinite(f.max) ? f.max : (fMin + 1);
        const mid = (fMin + fMax) / 2;
        const halfRange = (fMax - fMin) / 2;
        const codedVal = halfRange > 0 ? (numVal - mid) / halfRange : 0;
        let codedLabel = Number.isFinite(codedVal) ? `${codedVal >= 0 ? '+' : ''}${codedVal.toFixed(2)}` : '0.00';
        if (codedVal >= 0.95) codedLabel = 'High (+1.00)';
        else if (codedVal <= -0.95) codedLabel = 'Low (-1.00)';
        else if (Math.abs(codedVal) <= 0.05) codedLabel = 'Center (0.00)';

        // Calculate marginal sensitivity (derivative dY/dX at optimum)
        const step = Math.max(1e-4, (fMax - fMin) * 0.005);
        const stepUp = Math.min(fMax, numVal + step);
        const stepDown = Math.max(fMin, numVal - step);
        const dX = stepUp - stepDown;
        let natSlope = 0;
        if (dX > 0) {
          const yUp = predictAtSettings({ ...bestSettingsMap, [f.id]: stepUp });
          const yDown = predictAtSettings({ ...bestSettingsMap, [f.id]: stepDown });
          natSlope = (yUp - yDown) / dX;
        }

        return {
          factor: f,
          optimalValue: Number.isFinite(numVal) ? Number(numVal.toFixed(numVal % 1 === 0 ? 1 : 2)) : fMin,
          codedValue: Number.isFinite(codedVal) ? codedVal : 0,
          codedLabel,
          codedSlope: natSlope * halfRange,
          naturalSlope: natSlope,
          effectValue: natSlope * (fMax - fMin)
        };
      }
    });

    const optimalConditions = {
      expectedY: optStats.y_hat,
      desirability: Math.max(0, Math.min(1, bestD)),
      seFit: optStats.seMean,
      sePred: optStats.sePred,
      leverage: optStats.h00,
      tCrit: optStats.tCrit,
      ciLower: optStats.ciLower,
      ciUpper: optStats.ciUpper,
      piLower: optStats.piLower,
      piUpper: optStats.piUpper,
      rmse: Math.sqrt(mse),
      rSquared,
      adjRSquared,
      fRatio: f_model,
      pModel: p_model,
      dfError: df_error,
      factors: optimalFactors
    };

    const optimalSettings = optimalFactors;

    // Calculate VIF for each term
    const vifs: number[] = new Array(numTerms).fill(1.0);
    for (let i = 1; i < numTerms; i++) {
      if (aliased[i]) {
        vifs[i] = Infinity;
      } else if (diagInv[i] > 0) {
        let sumCol = 0;
        for (let r = 0; r < nRuns; r++) sumCol += X[r][i];
        const meanCol = sumCol / nRuns;
        let ssCol = 0;
        for (let r = 0; r < nRuns; r++) ssCol += Math.pow(X[r][i] - meanCol, 2);
        if (ssCol > 1e-9) {
          const calculatedVif = diagInv[i] * ssCol;
          vifs[i] = Math.max(1.0, Number(calculatedVif.toFixed(3)));
        }
      }
    }

    // Build Parameter Estimates table
    const parameterEstimates: any[] = [];
    
    // Intercept
    const intStdError = Math.sqrt(mse * diagInv[0]);
    const intTRatio = intStdError > 0 ? beta[0] / intStdError : 0;
    const intPVal = (df_error > 0 && intStdError > 0) ? (1 - jStat.studentt.cdf(Math.abs(intTRatio), df_error)) * 2 : 1;
    parameterEstimates.push({
      term: "Intercept",
      cleanTerm: "Intercept",
      estimate: beta[0],
      stdError: intStdError,
      tRatio: intTRatio,
      pVal: intPVal,
      isAliased: aliased[0],
      vif: 1.0
    });

    activeEffects.forEach(e => {
      e.colIndices.forEach((colIdx, idx) => {
        const stdError = Math.sqrt(mse * diagInv[colIdx]);
        const tRatio = stdError > 0 ? beta[colIdx] / stdError : 0;
        let pVal = 1;
        if (df_error > 0 && stdError > 0) {
          pVal = (1 - jStat.studentt.cdf(Math.abs(tRatio), df_error)) * 2;
        }

        parameterEstimates.push({
          term: e.columnNames[idx],
          cleanTerm: e.cleanNames[idx],
          factorId: e.factor?.id,
          f1Id: e.f1?.id,
          f2Id: e.f2?.id,
          estimate: beta[colIdx],
          stdError,
          tRatio,
          pVal,
          isAliased: aliased[colIdx],
          vif: vifs[colIdx]
        });
      });

      // For multi-level categorical factors (L >= 3), display the reference level row
      if (e.type === 'main' && e.factor?.type === 'categorical') {
        const levels = e.factor.levels || ['Level 1', 'Level 2'];
        if (levels.length >= 3) {
          const refLevel = levels[levels.length - 1];
          const sumBeta = e.colIndices.reduce((sum, c) => sum + beta[c], 0);
          let sumInv = 0;
          for (const r1 of e.colIndices) {
            for (const r2 of e.colIndices) {
              sumInv += invXtX[r1]?.[r2] || 0;
            }
          }
          const refStdError = (mse > 0 && sumInv > 0) ? Math.sqrt(mse * sumInv) : (df_error > 0 ? 0 : undefined);
          const refTRatio = (refStdError && refStdError > 0) ? (-sumBeta) / refStdError : undefined;
          let refPVal: number | undefined = undefined;
          if (df_error > 0 && refTRatio !== undefined) {
            refPVal = (1 - jStat.studentt.cdf(Math.abs(refTRatio), df_error)) * 2;
          }

          parameterEstimates.push({
            term: `${e.factor.name}[${refLevel}] (Reference)`,
            cleanTerm: `${e.factor.name}[${refLevel}]`,
            factorId: e.factor.id,
            estimate: -sumBeta,
            stdError: refStdError,
            tRatio: refTRatio,
            pVal: refPVal,
            isAliased: false,
            vif: undefined,
            isReference: true
          });
        }
      }
    });

    // Calculate Actual vs Predicted, Leverage, Cook's Distance, and Studentized Residuals
    const actualByPredicted: any[] = [];
    const studentizedResiduals: any[] = [];
    const h: number[] = [];
    const p_params = Math.max(1, rank);
    
    // tCrit for 95% limit in studentized residuals (approximate with t-dist or normal if large df)
    // using jStat for accurate studentized limit (Bonferroni corrected or not)
    const tLimit = df_error > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / 2, df_error)) : 3;
    const bonferroniLimit = df_error > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / (2 * nRuns), df_error)) : 3;

    validRuns.forEach((run, idx) => {
        const actual = Y[idx][0];
        let pred = 0;
        for (let i = 0; i < numTerms; i++) {
            pred += beta[i] * X[idx][i];
        }
        
        // Calculate leverage h_ii
        let hii = 0;
        for (let i = 0; i < numTerms; i++) {
            if (aliased[i]) continue;
            let sum = 0;
            for (let j = 0; j < numTerms; j++) {
                if (aliased[j]) continue;
                sum += X[idx][i] * invXtX[i][j] * X[idx][j];
            }
            hii += sum;
        }
        h.push(hii);
        
        const residual = actual - pred;
        let studentized = 0;
        if (mse > 1e-9 && hii < 0.9999) {
            studentized = residual / Math.sqrt(mse * (1 - hii));
        }

        // Cook's Distance: D_i = (studentized^2 / p) * (h_ii / (1 - h_ii))
        let cooksDistance = 0;
        if (mse > 1e-9 && hii < 0.9999) {
            cooksDistance = (Math.pow(studentized, 2) / p_params) * (hii / Math.max(1e-6, 1 - hii));
        }

        const isInfluential = cooksDistance > 1.0 || (nRuns > 25 && cooksDistance > (4 / nRuns));
        const isHighLeverage = hii > (2 * p_params / nRuns);
        const isOutlier = Math.abs(studentized) > 2.5;
        
        actualByPredicted.push({ actual, predicted: pred });
        studentizedResiduals.push({ 
            run: idx + 1, 
            studentized, 
            limit: tLimit, 
            bonferroniLimit,
            leverage: hii,
            cooksDistance,
            isInfluential,
            isHighLeverage,
            isOutlier,
            actual,
            predicted: pred,
            residual
        });
    });

    // Adequate Precision (Signal to Noise ratio: range of predicted values / sqrt(p * MSE / n))
    const predVals = actualByPredicted.map(d => d.predicted);
    const maxPred = predVals.length > 0 ? Math.max(...predVals) : 0;
    const minPred = predVals.length > 0 ? Math.min(...predVals) : 0;
    const avgPredVar = (p_params * mse) / Math.max(1, nRuns);
    const adequatePrecision = avgPredVar > 1e-12 
        ? (maxPred - minPred) / Math.sqrt(avgPredVar) 
        : (maxPred > minPred ? 99.9 : 0);

    // Box-Cox Profile Log-Likelihood estimation
    let boxCox: any = null;
    try {
        const minObs = Math.min(...observedY);
        const shift = minObs <= 0 ? Math.abs(minObs) + 1 : 0;
        const yShifted = observedY.map(y => y + shift);
        const logYSum = yShifted.reduce((sum, y) => sum + Math.log(y), 0);
        const geoMean = Math.exp(logYSum / nRuns);

        const evalBoxCox = (lam: number) => {
            const yTrans: number[][] = [];
            for (let r = 0; r < nRuns; r++) {
                const y = yShifted[r];
                let yt = 0;
                if (Math.abs(lam) < 1e-4) {
                    yt = geoMean * Math.log(y);
                } else {
                    yt = (Math.pow(y, lam) - 1) / (lam * Math.pow(geoMean, lam - 1));
                }
                yTrans.push([yt]);
            }
            const XtY_trans = multiply(transpose(X), yTrans);
            let sse_trans = 0;
            for (let r = 0; r < nRuns; r++) {
                let pred_trans = 0;
                for (let c = 0; c < numTerms; c++) {
                    if (aliased[c]) continue;
                    let b = 0;
                    for (let k = 0; k < numTerms; k++) {
                        if (!aliased[k]) b += invXtX[c][k] * XtY_trans[k][0];
                    }
                    pred_trans += b * X[r][c];
                }
                sse_trans += Math.pow(yTrans[r][0] - pred_trans, 2);
            }
            const logL = sse_trans > 1e-12 ? -(nRuns / 2) * Math.log(sse_trans / nRuns) : 0;
            return { logL, sse: sse_trans };
        };

        const grid: { lambda: number; logLikelihood: number }[] = [];
        let maxLogL = -Infinity;
        let bestLambda = 1.0;

        for (let lam = -2.0; lam <= 2.001; lam += 0.1) {
            const lRounded = Math.round(lam * 10) / 10;
            const { logL } = evalBoxCox(lRounded);
            grid.push({ lambda: lRounded, logLikelihood: logL });
            if (logL > maxLogL) {
                maxLogL = logL;
                bestLambda = lRounded;
            }
        }

        const cutoffLogL = maxLogL - 1.92;
        const ciLambdas = grid.filter(g => g.logLikelihood >= cutoffLogL).map(g => g.lambda);
        const ciLow = ciLambdas.length > 0 ? Math.min(...ciLambdas) : bestLambda;
        const ciHigh = ciLambdas.length > 0 ? Math.max(...ciLambdas) : bestLambda;
        const isOneInCi = 1.0 >= ciLow && 1.0 <= ciHigh;

        const standardOptions = [
            { lambda: -1, name: "Inverse (1/Y)", label: "1 / Y" },
            { lambda: -0.5, name: "Inverse Sqrt (1/√Y)", label: "1 / √Y" },
            { lambda: 0, name: "Natural Log (ln Y)", label: "ln(Y)" },
            { lambda: 0.5, name: "Square Root (√Y)", label: "√Y" },
            { lambda: 1, name: "None (Current Scale)", label: "Y" },
            { lambda: 2, name: "Square (Y²)", label: "Y²" },
        ];
        const closestStandard = standardOptions.reduce((prev, curr) =>
            Math.abs(curr.lambda - bestLambda) < Math.abs(prev.lambda - bestLambda) ? curr : prev
        );

        boxCox = {
            shift,
            optimalLambda: bestLambda,
            ciLow,
            ciHigh,
            isOneInCi,
            recommendedTransform: closestStandard.name,
            recommendedLabel: closestStandard.label,
            recommendedLambda: closestStandard.lambda,
            grid: grid.filter((_, idx) => idx % 2 === 0),
            maxLogL,
            cutoffLogL
        };
    } catch {
        boxCox = null;
    }

    return { 
      response: activeResponse, 
      effects, 
      paretoData, 
      optimalSettings, 
      optimalConditions,
      halfNormalData, 
      halfNormalLine,
      bestPred, 
      rSquared, 
      adjRSquared, 
      p: p_model, 
      nRuns, 
      paretoThreshold, 
      tLimitPareto,
      bonferroniLimitPareto,
      effectSummary, 
      lackOfFit, 
      parameterEstimates,
      rmse: Math.sqrt(mse),
      fRatio: f_model,
      dfError: df_error,
      mse,
      actualByPredicted,
      studentizedResiduals,
      adequatePrecision,
      boxCox,
      activeEffects,
      beta,
      aliased,
      predictAtSettings
    };

}

/**
 * Predicts the response value using the fitted regression model (OLS)
 * for any given natural/categorical factor settings.
 */
export function predictModelResponse(
  analysisResult: any,
  factorSettings: Record<string, any>,
  project: Project
): number {
  if (!analysisResult) return 0;

  if (typeof analysisResult.predictAtSettings === 'function') {
    try {
      const p = analysisResult.predictAtSettings(factorSettings);
      if (Number.isFinite(p)) return p;
    } catch (e) {
      // Fall through to activeEffects predictor
    }
  }

  // Modern robust predictor using activeEffects and beta
  if (analysisResult.activeEffects && analysisResult.beta && Array.isArray(analysisResult.beta)) {
    let pred = analysisResult.beta[0]; // Intercept
    analysisResult.activeEffects.forEach((e: any) => {
      if (e.type === 'main' && e.factor) {
        const rawVal = factorSettings[e.factor.id] !== undefined
          ? factorSettings[e.factor.id]
          : factorSettings[e.factor.name];
        const contrasts = getFactorContrasts(e.factor, rawVal);
        e.colIndices.forEach((colIdx: number, idx: number) => {
          if (!analysisResult.aliased[colIdx] && contrasts[idx] !== undefined) {
            pred += analysisResult.beta[colIdx] * contrasts[idx];
          }
        });
      } else if (e.type === 'interaction' && e.f1 && e.f2) {
        const rawVal1 = factorSettings[e.f1.id] !== undefined
          ? factorSettings[e.f1.id]
          : factorSettings[e.f1.name];
        const rawVal2 = factorSettings[e.f2.id] !== undefined
          ? factorSettings[e.f2.id]
          : factorSettings[e.f2.name];
        const c1 = getFactorContrasts(e.f1, rawVal1);
        const c2 = getFactorContrasts(e.f2, rawVal2);
        let ptr = 0;
        for (let p = 0; p < c1.length; p++) {
          for (let q = 0; q < c2.length; q++) {
            const colIdx = e.colIndices[ptr++];
            if (colIdx !== undefined && !analysisResult.aliased[colIdx]) {
              pred += analysisResult.beta[colIdx] * (c1[p] * c2[q]);
            }
          }
        }
      }
    });
    return pred;
  }

  // Fallback to parameter estimates parsing if activeEffects not directly attached
  const factorScalesById: Record<string, number> = {};
  const factorScalesByName: Record<string, number> = {};

  project.factors.forEach(f => {
    const rawVal = factorSettings[f.id] !== undefined
      ? factorSettings[f.id]
      : (factorSettings[f.name] !== undefined ? factorSettings[f.name] : (f.min + f.max) / 2);
    const contrasts = getFactorContrasts(f, rawVal);
    const coded = contrasts[0] ?? 0;
    factorScalesById[f.id] = coded;
    factorScalesByName[f.name] = coded;
  });

  if (analysisResult.parameterEstimates && Array.isArray(analysisResult.parameterEstimates)) {
    let pred = 0;
    analysisResult.parameterEstimates.forEach((est: any) => {
      if (est.isAliased || est.isReference) return;
      if (est.term === 'Intercept') {
        pred += est.estimate;
      } else if (est.f1Id && est.f2Id) {
        const p1 = factorScalesById[est.f1Id];
        const p2 = factorScalesById[est.f2Id];
        if (p1 !== undefined && p2 !== undefined) {
          pred += est.estimate * p1 * p2;
        }
      } else if (est.factorId) {
        const p = factorScalesById[est.factorId];
        if (p !== undefined) {
          pred += est.estimate * p;
        }
      } else if (est.term.includes('*')) {
        const parts = est.term.split('*').map((s: string) => s.trim().replace(/\(.*?\)/g, ''));
        const p1 = factorScalesByName[parts[0]];
        const p2 = factorScalesByName[parts[1]];
        if (p1 !== undefined && p2 !== undefined) {
          pred += est.estimate * p1 * p2;
        }
      } else {
        const cleanName = est.cleanTerm || est.term.replace(/\(.*?\)/g, '').trim();
        const p = factorScalesByName[cleanName];
        if (p !== undefined) {
          pred += est.estimate * p;
        }
      }
    });
    return pred;
  }

  return 0;
}
