import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// We need to inject tRatio calculation into effects.
// We also need to get Bonferroni limit for Pareto chart.

const target1 = `    // 7. Data for Plots (always show all primary and secondary effects; exclude aliased and excluded terms)
    const combinedEffectsForPlot = [
      ...effects.filter(e => !e.isAliased && !e.isExcluded).map(e => ({ name: e.factor.name, absEffect: e.absEffect, direction: e.direction, factor: e.factor })),
      ...interactions.filter(e => !e.isAliased && !e.isExcluded).map(e => ({ name: e.id, absEffect: e.absEffect, direction: e.direction, factor: { name: e.id } }))
    ];`;

const replacement1 = `    // Calculate standard errors and t-Ratios for all terms
    const stdErrors = new Array(numTerms).fill(0);
    const tRatios = new Array(numTerms).fill(0);
    
    // If df_error is 0 (saturated), we use Lenth's PSE for the standard error of effects
    // effect = beta * 2. So SE(effect) = PSE. So SE(beta) = PSE / 2.
    // If df_error > 0, SE(beta) = sqrt(mse * diagInv)
    
    for (let i = 0; i < numTerms; i++) {
        if (df_error > 0) {
            stdErrors[i] = Math.sqrt(mse * diagInv[i]);
        } else {
            stdErrors[i] = pse / 2;
        }
        tRatios[i] = stdErrors[i] > 0 ? beta[i] / stdErrors[i] : 0;
    }

    const tLimitPareto = df_error > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / 2, df_error)) : 3; // Approx 3 if no df
    
    // 7. Data for Plots (always show all primary and secondary effects; exclude aliased and excluded terms)
    const combinedEffectsForPlot = [
      ...effects.filter(e => !e.isAliased && !e.isExcluded).map(e => ({ 
          name: e.factor.name, 
          absEffect: e.absEffect, 
          direction: e.direction, 
          factor: e.factor,
          tRatio: Math.abs(tRatios[e.betaIdx])
      })),
      ...interactions.filter(e => !e.isAliased && !e.isExcluded).map(e => ({ 
          name: e.id, 
          absEffect: e.absEffect, 
          direction: e.direction, 
          factor: { name: e.id },
          tRatio: Math.abs(tRatios[e.betaIdx])
      }))
    ];`;

content = content.replace(target1, replacement1);

const target2 = `    const sortedForHalfNormal = [...combinedEffectsForPlot].sort((a, b) => a.absEffect - b.absEffect);
    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.absEffect > paretoThreshold };
    });
    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.absEffect - a.absEffect);`;

const replacement2 = `    const sortedForHalfNormal = [...combinedEffectsForPlot].sort((a, b) => a.tRatio - b.tRatio);
    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.tRatio > tLimitPareto };
    });
    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.tRatio - a.tRatio);`;

content = content.replace(target2, replacement2);

// Add tLimitPareto and bonferroniLimitPareto to the return object
const targetReturn = `      paretoThreshold, 
      effectSummary,`;

const numTermsCalculated = `    const bonferroniLimitPareto = df_error > 0 && activeTerms.length > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / (2 * activeTerms.length), df_error)) : 3.5;
`;

const replacementReturn = `      paretoThreshold, 
      tLimitPareto,
      bonferroniLimitPareto,
      effectSummary,`;

// Let's just do a RegExp to find the return block and insert
content = content.replace(targetReturn, replacementReturn);

// Also insert the variable calculation before the return
content = content.replace(`    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.tRatio - a.tRatio);`, `    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.tRatio - a.tRatio);\n    const bonferroniLimitPareto = df_error > 0 && activeTerms.length > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / (2 * activeTerms.length), df_error)) : 3.5;`);

// Update Pareto Plot
const targetPareto = `                    <XAxis type="number" dataKey="absEffect" name="Absolute Effect" tick={{fontSize: 10}} />
                    <YAxis type="category" dataKey="factor.name" width={100} interval={0} tick={{fontSize: 10}} />
                    {analysisResults.paretoThreshold > 0 && <ReferenceLine x={analysisResults.paretoThreshold} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Threshold', fill: 'red', fontSize: 10 }} />}`;

const replacementPareto = `                    <XAxis type="number" dataKey="tRatio" name="t-Ratio" tick={{fontSize: 10}} />
                    <YAxis type="category" dataKey="factor.name" width={100} interval={0} tick={{fontSize: 10}} />
                    <ReferenceLine x={analysisResults.tLimitPareto} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'top', value: 't-Limit', fill: '#3b82f6', fontSize: 9 }} />
                    <ReferenceLine x={analysisResults.bonferroniLimitPareto} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'bottom', value: 'Bonferroni', fill: '#ef4444', fontSize: 9 }} />`;

content = content.replace(targetPareto, replacementPareto);


fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Done pareto modifications.');
