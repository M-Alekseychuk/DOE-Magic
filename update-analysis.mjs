import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const startStr = "  // Compute effects and predictive model\n  const analysisResults = useMemo(() => {";
const endStr = "  }, [project, hasData, activeResponse, effectsLevelFilter]);";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find bounds.", {startIndex, endIndex});
  process.exit(1);
}

const replacement = `  // Compute effects and predictive model (OLS Matrix Inversion)
  const analysisResults = useMemo(() => {
    if (!hasData || !activeResponse) return null;

    const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null);
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

    // 2. Perform OLS Matrix Math
    const Xt = transpose(X);
    const XtX = multiply(Xt, X);
    const XtX_inv = invertMatrix(XtX);

    const numTerms = 1 + k + (k * (k - 1)) / 2;
    let beta = new Array(numTerms).fill(0);
    let diagInv = new Array(numTerms).fill(1);
    let isSingular = true;

    if (XtX_inv) {
        isSingular = false;
        beta = multiply(multiply(XtX_inv, Xt), Y).map(r => r[0]);
        for(let i=0; i<diagInv.length; i++) diagInv[i] = XtX_inv[i][i];
    } else {
        // Fallback: Matrix is singular (e.g. perfectly aliased saturated design).
        // Fallback to simple averages for Beta. (Will inflate error but guarantees display).
        beta[0] = overallMean;
        
        // Main Effects Simple Avg Fallback
        for (let i = 0; i < k; i++) {
            const f = project.factors[i];
            const mid = (f.min + f.max) / 2;
            let hSum = 0, hC = 0, lSum = 0, lC = 0;
            validRuns.forEach(r => {
                const v = Number(r.factors[f.id]);
                if (v > mid + 1e-6) { hSum += Number(r.responses[activeResponse.id]); hC++; }
                else if (v < mid - 1e-6) { lSum += Number(r.responses[activeResponse.id]); lC++; }
            });
            const effect = (hC > 0 && lC > 0) ? (hSum/hC - lSum/lC) : 0;
            beta[1 + i] = effect / 2;
        }

        // Interactions Simple Avg Fallback
        let intIdx = 0;
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                const f1 = project.factors[i];
                const f2 = project.factors[j];
                const mid1 = (f1.min + f1.max) / 2;
                const mid2 = (f2.min + f2.max) / 2;
                let hh = 0, hhC = 0, hl = 0, hlC = 0, lh = 0, lhC = 0, ll = 0, llC = 0;
                validRuns.forEach(r => {
                    const v1 = Number(r.factors[f1.id]);
                    const v2 = Number(r.factors[f2.id]);
                    const res = Number(r.responses[activeResponse.id]);
                    if (v1 > mid1 + 1e-6 && v2 > mid2 + 1e-6) { hh+=res; hhC++; }
                    else if (v1 > mid1 + 1e-6 && v2 < mid2 - 1e-6) { hl+=res; hlC++; }
                    else if (v1 < mid1 - 1e-6 && v2 > mid2 + 1e-6) { lh+=res; lhC++; }
                    else if (v1 < mid1 - 1e-6 && v2 < mid2 - 1e-6) { ll+=res; llC++; }
                });
                const hhAvg = hhC>0?hh/hhC:0, hlAvg=hlC>0?hl/hlC:0, lhAvg=lhC>0?lh/lhC:0, llAvg=llC>0?ll/llC:0;
                const effect = (hhC>0 && hlC>0 && lhC>0 && llC>0) ? ((hhAvg + llAvg - hlAvg - lhAvg)/2) : 0;
                beta[1 + k + intIdx] = effect / 2;
                intIdx++;
            }
        }
    }

    // 3. Map Beta back to UI objects and calculate SS Model/Error
    const effects: any[] = [];
    for (let i = 0; i < k; i++) {
        const factor = project.factors[i];
        const effectVal = beta[1 + i] * 2; // Beta is half-effect
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
            betaIdx: 1 + i
        });
    }

    const interactions: any[] = [];
    let intIdx = 0;
    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            const effectVal = beta[1 + k + intIdx] * 2;
            interactions.push({
                f1: project.factors[i],
                f2: project.factors[j],
                effect: effectVal,
                absEffect: Math.abs(effectVal),
                direction: effectVal >= 0 ? 'Positive' : 'Negative',
                betaIdx: 1 + k + intIdx
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

    const p_model = numTerms - 1; // parameters excluding intercept
    const df_error = Math.max(0, nRuns - numTerms);
    const mse = df_error > 0 ? sse / df_error : 0;
    
    const rSquared = sst > 0 ? 1 - (sse / sst) : 0;
    let adjRSquared = 0;
    if (df_error > 0 && sst > 0) {
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

    // df_lof = Unique points - num parameters
    const df_lof = Math.max(0, uniquePoints - numTerms);
    const ss_lof = Math.max(0, sse - ss_pure);

    const ms_lof = df_lof > 0 ? ss_lof / df_lof : 0;
    const ms_pure = df_pure > 0 ? ss_pure / df_pure : 0;
    const f_lof = ms_pure > 0 ? ms_lof / ms_pure : (ms_lof > 0 ? Infinity : 0);
    
    let p_lof = null;
    if (df_lof > 0 && df_pure > 0 && ms_pure > 0) {
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

    // Use pure error if model is over-parameterized or perfectly saturated but has replicates
    if (test_df <= 0 && df_pure > 0) {
        test_df = df_pure;
        test_ms = ms_pure;
    }

    // Lenth's Pseudo Standard Error (for unreplicated, saturated designs)
    let useLenths = false;
    let paretoThreshold = 0;
    
    const allEffectsAbs = [...effects.map(e => e.absEffect), ...interactions.map(i => i.absEffect)];
    const s0 = 1.5 * jStat.median(allEffectsAbs);
    const retainedEffects = allEffectsAbs.filter(e => e < 2.5 * s0);
    const pse = 1.5 * jStat.median(retainedEffects);
    
    if (test_df <= 0 || test_ms === 0) {
        useLenths = true;
        test_ms = Math.pow(pse, 2) / (nRuns / 4); // convert PSE to pseudo-MS
        test_df = Math.max(1, Math.floor(allEffectsAbs.length / 3));
    }
    paretoThreshold = 2.12 * pse;

    // 6. Partial Sum of Squares (Type III ANOVA) for individual terms
    const effectSummary: any[] = [];
    
    // Helper to add term to summary
    const addTermToSummary = (name: string, betaIdx: number, effectValue: number) => {
        let ss = 0;
        if (!isSingular && diagInv[betaIdx] > 0) {
            // Type III SS = (beta_k ^ 2) / C_kk
            ss = Math.pow(beta[betaIdx], 2) / diagInv[betaIdx];
        } else {
            // Fallback for singular matrix (approximates orthogonal)
            ss = (nRuns / 4) * Math.pow(effectValue, 2);
        }
        
        let pVal = 1;
        let logworth = 0;
        if (test_df > 0 && test_ms > 0) {
            const fRatio = test_ms > 0 ? ss / test_ms : 0;
            pVal = 1 - jStat.centralF.cdf(fRatio, 1, test_df);
            if (pVal < 1e-15) pVal = 1e-15;
            logworth = -Math.log10(pVal);
        }
        effectSummary.push({ name, logworth, pVal, ss });
    };

    if (effectsLevelFilter !== 'secondary') {
        effects.forEach(e => addTermToSummary(\`\${e.factor.name}(\${e.factor.min},\${e.factor.max})\`, e.betaIdx, e.effect));
    }
    if (effectsLevelFilter !== 'primary') {
        interactions.forEach(int => addTermToSummary(\`\${int.f1.name}*\${int.f2.name}\`, int.betaIdx, int.effect));
    }
    effectSummary.sort((a, b) => b.logworth - a.logworth);

    // 7. Data for Half-Normal and Pareto Plots
    const combinedEffectsForPlot = [
      ...(effectsLevelFilter !== 'secondary' ? effects.map(e => ({ name: e.factor.name, absEffect: e.absEffect, direction: e.direction, factor: e.factor })) : []),
      ...(effectsLevelFilter !== 'primary' ? interactions.map(i => ({ name: \`\${i.f1.name}*\${i.f2.name}\`, absEffect: i.absEffect, direction: i.direction, factor: { name: \`\${i.f1.name}*\${i.f2.name}\` } })) : [])
    ];
    
    const sortedForHalfNormal = combinedEffectsForPlot.sort((a, b) => a.absEffect - b.absEffect);
    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / sortedForHalfNormal.length);
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

code = code.substring(0, startIndex) + replacement + "\n" + code.substring(endIndex);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
console.log("Successfully replaced useMemo.");
