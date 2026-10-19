const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const importJstat = `// @ts-ignore
import jstat from 'jstat';
const jStat = (jstat as any).default || jstat;
`;

if (!code.includes("import jstat")) {
    code = code.replace("import Plot from 'react-plotly.js';", "import Plot from 'react-plotly.js';\n" + importJstat);
}

const replacement = `
    const rSquared = sst > 0 ? 1 - (sse / sst) : 0;
    const p = k + (k * (k - 1)) / 2; // main effects + 2-way interactions
    const nRuns = validRuns.length;
    let adjRSquared = 0;
    const df_error = nRuns - p - 1;
    if (df_error > 0 && sst > 0) {
      adjRSquared = 1 - (1 - rSquared) * ((nRuns - 1) / df_error);
    }

    // ANOVA Effect Summary
    const effectSummary: any[] = [];
    
    // Add Main Effects
    for (let i = 0; i < k; i++) {
        const f = project.factors[i];
        const eff = effects.find(e => e.factor.id === f.id);
        const effectVal = eff?.effect || 0;
        const ss = (nRuns / 4) * Math.pow(effectVal, 2);
        let pVal = 1;
        let logworth = 0;
        if (df_error > 0 && sse > 0) {
            const ms_error = sse / df_error;
            const fRatio = ms_error > 0 ? ss / ms_error : 0;
            pVal = 1 - jStat.centralF.cdf(fRatio, 1, df_error);
            if (pVal < 1e-15) pVal = 1e-15;
            logworth = -Math.log10(pVal);
        }
        effectSummary.push({
            name: \`\${f.name}(\${f.min},\${f.max})\`,
            logworth,
            pVal,
            ss
        });
    }

    // Add Interactions
    for (let i = 0; i < interactions.length; i++) {
        const int = interactions[i];
        const ss = (nRuns / 4) * Math.pow(int.effect, 2);
        let pVal = 1;
        let logworth = 0;
        if (df_error > 0 && sse > 0) {
            const ms_error = sse / df_error;
            const fRatio = ms_error > 0 ? ss / ms_error : 0;
            pVal = 1 - jStat.centralF.cdf(fRatio, 1, df_error);
            if (pVal < 1e-15) pVal = 1e-15;
            logworth = -Math.log10(pVal);
        }
        effectSummary.push({
            name: \`\${int.f1.name}*\${int.f2.name}\`,
            logworth,
            pVal,
            ss
        });
    }

    effectSummary.sort((a, b) => b.logworth - a.logworth);

    // Lack Of Fit
    const runGroups: Record<string, number[]> = {};
    validRuns.forEach(run => {
        const key = project.factors.map(f => Number(run.factors[f.id])).join(',');
        if (!runGroups[key]) runGroups[key] = [];
        runGroups[key].push(Number(run.responses[activeResponse.id]));
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

    const ss_lof = Math.max(0, sse - ss_pure);
    const df_lof = Math.max(0, df_error - df_pure);

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

    return { response: activeResponse, effects, optimalSettings, halfNormalData, bestPred, rSquared, adjRSquared, p, nRuns, paretoThreshold, effectSummary, lackOfFit };
`;

const targetStart = `    const rSquared = sst > 0 ? 1 - (sse / sst) : 0;`;
const targetEnd = `    return { response: activeResponse, effects, optimalSettings, halfNormalData, bestPred, rSquared, adjRSquared, p, nRuns, paretoThreshold };`;

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd) + targetEnd.length;

if (startIndex > -1 && endIndex > -1) {
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
    console.log("Replaced analysis section.");
} else {
    console.log("Could not find targets.");
}

