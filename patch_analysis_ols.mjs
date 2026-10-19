import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Replace invertMatrix with solveOLS
const invertMatrixStart = code.indexOf('function invertMatrix');
const invertMatrixEnd = code.indexOf('export default function ProjectAnalysis');

if (invertMatrixStart === -1 || invertMatrixEnd === -1) {
    console.error("Could not find invertMatrix function");
    process.exit(1);
}

const newMathFunctions = `function transpose(m: number[][]) {
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
    
    // Augment: [ XtX | XtY | I ]
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
        
        if (pivotRow !== currentRow) {
            const temp = aug[currentRow];
            aug[currentRow] = aug[pivotRow];
            aug[pivotRow] = temp;
        }
        
        const pivot = aug[currentRow][col];
        for (let c = col; c < aug[currentRow].length; c++) {
            aug[currentRow][c] /= pivot;
        }
        
        for (let r = 0; r < k; r++) {
            if (r !== currentRow) {
                const factor = aug[r][col];
                for (let c = col; c < aug[r].length; c++) {
                    aug[r][c] -= factor * aug[currentRow][c];
                }
            }
        }
        
        colToRow[col] = currentRow;
        currentRow++;
    }
    
    const rank = currentRow;
    const beta = new Array(k).fill(0);
    const diagInv = new Array(k).fill(0);
    
    for (let col = 0; col < k; col++) {
        if (!aliased[col]) {
            const r = colToRow[col];
            beta[col] = aug[r][k];
            diagInv[col] = Math.max(0, aug[r][k + 1 + col]);
        }
    }
    
    return { beta, diagInv, aliased, rank };
}

`;

code = code.substring(0, invertMatrixStart) + newMathFunctions + code.substring(invertMatrixEnd);


// Now replace the useMemo contents
const useMemoStartStr = "  // Compute effects and predictive model (OLS Matrix Inversion)\n  const analysisResults = useMemo(() => {";
const useMemoEndStr = "  }, [project, hasData, activeResponse, effectsLevelFilter]);";

const useMemoStart = code.indexOf(useMemoStartStr);
const useMemoEnd = code.indexOf(useMemoEndStr, useMemoStart);

if (useMemoStart === -1 || useMemoEnd === -1) {
    console.error("Could not find useMemo block bounds");
    process.exit(1);
}

const replacement = `  // Compute effects and predictive model (Robust OLS Matrix Inversion with Aliasing Detection)
  const analysisResults = useMemo(() => {
    if (!hasData || !activeResponse) return null;

    const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && r.responses[activeResponse.id] !== '');
    if (validRuns.length === 0) return null;

    const k = project.factors.length;
    const nRuns = validRuns.length;
    const overallMean = validRuns.reduce((sum, r) => sum + Number(r.responses[activeResponse.id]), 0) / validRuns.length;

    // 1. Build Design Matrix X and Response Vector Y for OLS
    const X: number[][] = [];
    const Y: number[][] = [];
    
    validRuns.forEach(run => {
        const res = Number(run.responses[activeResponse.id]);
        Y.push([res]);
        
        const row = [1]; // Intercept
        
        // Main effects
        const x_vals: number[] = [];
        for (let i = 0; i < k; i++) {
            const f = project.factors[i];
            const val = Number(run.factors[f.id]);
            const mid = (f.min + f.max) / 2;
            const range = (f.max - f.min) || 1;
            const x = 2 * (val - mid) / range; // Maps to -1 to +1
            x_vals.push(x);
            row.push(x);
        }
        
        // 2-way Interactions
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                row.push(x_vals[i] * x_vals[j]);
            }
        }
        
        X.push(row);
    });

    // 2. Perform Robust OLS solving
    const { beta, diagInv, aliased, rank } = solveOLS(X, Y);
    const numTerms = X[0].length;

    // 3. Map Beta back to UI objects
    const effects: any[] = [];
    for (let i = 0; i < k; i++) {
        const factor = project.factors[i];
        const betaIdx = 1 + i;
        const effectVal = beta[betaIdx] * 2; // Beta is half-effect
        const isAliased = aliased[betaIdx];
        
        // Calculate averages purely for descriptive UI
        const mid = (factor.min + factor.max) / 2;
        let highSum = 0, highCount = 0, lowSum = 0, lowCount = 0;
        validRuns.forEach(r => {
            const v = Number(r.factors[factor.id]);
            if (v > mid + 1e-6) { highSum += Number(r.responses[activeResponse.id]); highCount++; }
            else if (v < mid - 1e-6) { lowSum += Number(r.responses[activeResponse.id]); lowCount++; }
        });
        
        effects.push({
            factor,
            effect: effectVal,
            absEffect: Math.abs(effectVal),
            direction: effectVal >= 0 ? 'Positive' : 'Negative',
            lowAvg: lowCount > 0 ? lowSum / lowCount : 0,
            highAvg: highCount > 0 ? highSum / highCount : 0,
            highCount, lowCount,
            betaIdx,
            isAliased
        });
    }

    const interactions: any[] = [];
    let intIdx = 0;
    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            const betaIdx = 1 + k + intIdx;
            const effectVal = beta[betaIdx] * 2;
            interactions.push({
                f1: project.factors[i],
                f2: project.factors[j],
                effect: effectVal,
                absEffect: Math.abs(effectVal),
                direction: effectVal >= 0 ? 'Positive' : 'Negative',
                betaIdx,
                isAliased: aliased[betaIdx]
            });
            intIdx++;
        }
    }

    effects.sort((a, b) => b.absEffect - a.absEffect);

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
    
    const rSquared = sst > 0 ? 1 - (sse / sst) : 0;
    let adjRSquared = 0;
    if (df_error > 0 && sst > 0 && nRuns > 1) {
        adjRSquared = 1 - (1 - rSquared) * ((nRuns - 1) / df_error);
    }

    // 5. Lack Of Fit and Pure Error
    const runGroups: Record<string, number[]> = {};
    validRuns.forEach(run => {
        const key = project.factors.map(f => Number(run.factors[f.id])).join(',');
        if (!runGroups[key]) runGroups[key] = [];
        runGroups[key].push(Number(run.responses[activeResponse.id]));
    });

    let ss_pure = 0;
    let df_pure = 0;
    const uniquePoints = Object.keys(runGroups).length;
    
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
    
    // Helper to add term to summary
    const addTermToSummary = (name: string, betaIdx: number, effectValue: number, isAliased: boolean) => {
        let ss = 0;
        let logworth = 0;
        let pVal = 1;
        let fRatio = 0;
        
        if (isAliased) {
            // Aliased term contributes 0 SS
            ss = 0;
            pVal = 1;
        } else if (diagInv[betaIdx] > 0) {
            // Type III SS = (beta_k ^ 2) / C_kk
            ss = Math.pow(beta[betaIdx], 2) / diagInv[betaIdx];
            if (test_df > 0 && test_ms > 0) {
                fRatio = ss / test_ms;
                pVal = 1 - jStat.centralF.cdf(fRatio, 1, test_df);
                if (pVal < 1e-15) pVal = 1e-15;
                logworth = -Math.log10(pVal);
            }
        }
        
        effectSummary.push({ name: name + (isAliased ? " (Aliased)" : ""), logworth, pVal, ss, fRatio, isAliased });
    };

    if (effectsLevelFilter !== 'secondary') {
        effects.forEach(e => addTermToSummary(\`\${e.factor.name}(\${e.factor.min},\${e.factor.max})\`, e.betaIdx, e.effect, e.isAliased));
    }
    if (effectsLevelFilter !== 'primary') {
        interactions.forEach(int => addTermToSummary(\`\${int.f1.name}*\${int.f2.name}\`, int.betaIdx, int.effect, int.isAliased));
    }
    effectSummary.sort((a, b) => {
        if (a.isAliased && !b.isAliased) return 1;
        if (!a.isAliased && b.isAliased) return -1;
        return b.logworth - a.logworth;
    });

    // 7. Data for Plots (exclude aliased terms from Pareto/Half-Normal)
    const combinedEffectsForPlot = [
      ...(effectsLevelFilter !== 'secondary' ? effects.filter(e => !e.isAliased).map(e => ({ name: e.factor.name, absEffect: e.absEffect, direction: e.direction, factor: e.factor })) : []),
      ...(effectsLevelFilter !== 'primary' ? interactions.filter(i => !i.isAliased).map(i => ({ name: \`\${i.f1.name}*\${i.f2.name}\`, absEffect: i.absEffect, direction: i.direction, factor: { name: \`\${i.f1.name}*\${i.f2.name}\` } })) : [])
    ];
    
    const sortedForHalfNormal = combinedEffectsForPlot.sort((a, b) => a.absEffect - b.absEffect);
    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.absEffect > paretoThreshold };
    });
    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.absEffect - a.absEffect);

    // 8. Optimizer
    let bestCombo: number[] = [];
    let bestPred = activeResponse.goal === 'maximize' ? -Infinity : Infinity;
    let closestToTarget = Infinity;
    const numCombos = Math.pow(2, k);
    
    for (let c = 0; c < numCombos; c++) {
      const combo = [];
      for (let i = 0; i < k; i++) combo.push((c >> i) & 1);
      
      let pred = beta[0];
      for (let i = 0; i < k; i++) {
        const x_i = combo[i] === 1 ? 1 : -1;
        pred += beta[1 + i] * x_i;
      }
      
      let intI = 0;
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const x_i = combo[i] === 1 ? 1 : -1;
          const x_j = combo[j] === 1 ? 1 : -1;
          pred += beta[1 + k + intI] * (x_i * x_j);
          intI++;
        }
      }
      
      if (activeResponse.goal === 'maximize') {
        if (pred > bestPred) { bestPred = pred; bestCombo = combo; }
      } else if (activeResponse.goal === 'minimize') {
        if (pred < bestPred) { bestPred = pred; bestCombo = combo; }
      } else {
        const target = activeResponse.targetValue ?? 0;
        const dist = Math.abs(pred - target);
        if (dist < closestToTarget) { closestToTarget = dist; bestPred = pred; bestCombo = combo; }
      }
    }

    let optimalSettings: any[] = [];
    if (bestCombo.length === k && k > 0) {
      optimalSettings = project.factors.map((f, i) => {
        const isHigh = bestCombo[i] === 1;
        return {
          factor: f,
          optimalValue: isHigh ? f.max : f.min,
          effectValue: beta[1 + i] * 2
        };
      });
    }

    return { response: activeResponse, effects, paretoData, optimalSettings, halfNormalData, bestPred, rSquared, adjRSquared, p: p_model, nRuns, paretoThreshold, effectSummary, lackOfFit };`;

code = code.substring(0, useMemoStart) + replacement + "\n" + code.substring(useMemoEnd);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
console.log("Successfully applied rigorous OLS solver with aliasing detection");
