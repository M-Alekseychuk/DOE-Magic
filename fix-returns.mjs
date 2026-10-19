import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /return \{ response: activeResponse, effects, paretoData, optimalSettings, halfNormalData, bestPred, rSquared, adjRSquared, p: p_model, nRuns, paretoThreshold, effectSummary, lackOfFit \};/;

const replacer = `const parameterEstimates = [];
    for (let i = 0; i < numTerms; i++) {
        const stdError = Math.sqrt(mse * diagInv[i]);
        const tRatio = stdError > 0 ? beta[i] / stdError : 0;
        let pVal = 1;
        if (df_error > 0 && stdError > 0) {
            pVal = (1 - jStat.studentt.cdf(Math.abs(tRatio), df_error)) * 2;
        }
        
        let termName = "Intercept";
        if (i > 0) {
            const term = activeTerms[i - 1];
            if (term && term.type === 'main') {
                termName = \`\${term.factor.name}(\${term.factor.min},\${term.factor.max})\`;
            } else if (term && term.type === 'interaction') {
                termName = \`\${term.f1.name}*\${term.f2.name}\`;
            }
        }
        
        parameterEstimates.push({
            term: termName,
            estimate: beta[i],
            stdError,
            tRatio,
            pVal,
            isAliased: aliased[i]
        });
    }

    return { response: activeResponse, effects, paretoData, optimalSettings, halfNormalData, bestPred, rSquared, adjRSquared, p: p_model, nRuns, paretoThreshold, effectSummary, lackOfFit, parameterEstimates };`;

code = code.replace(regex, replacer);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
