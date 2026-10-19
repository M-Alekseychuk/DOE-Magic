import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const target = `    // 7. Data for Plots (always show all primary and secondary effects; exclude aliased and excluded terms)
    const combinedEffectsForPlot = [
      ...effects.filter(e => !e.isAliased && !e.isExcluded).map(e => ({ name: e.factor.name, absEffect: e.absEffect, direction: e.direction, factor: e.factor })),
      ...interactions.filter(i => !i.isAliased && !i.isExcluded).map(i => ({ name: \`\${i.f1.name}*\${i.f2.name}\`, absEffect: i.absEffect, direction: i.direction, factor: { name: \`\${i.f1.name}*\${i.f2.name}\` } }))
    ];`;

const replacement = `    // Calculate standard errors and t-Ratios for all terms
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
      ...interactions.filter(i => !i.isAliased && !i.isExcluded).map(i => ({ 
          name: \`\${i.f1.name}*\${i.f2.name}\`, 
          absEffect: i.absEffect, 
          direction: i.direction, 
          factor: { name: \`\${i.f1.name}*\${i.f2.name}\` },
          tRatio: Math.abs(tRatios[i.betaIdx])
      }))
    ];`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
    console.log("Fixed tRatio and tLimitPareto variables.");
} else {
    console.log("Could not find target!");
}
