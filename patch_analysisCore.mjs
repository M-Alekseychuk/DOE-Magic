import fs from 'fs';

let content = fs.readFileSync('src/utils/analysisCore.ts', 'utf8');

const searchEffects = `        let highSum = 0, highCount = 0;
        let lowSum = 0, lowCount = 0;
        const mid = (factor.min + factor.max) / 2;
        validRuns.forEach(r => {
            const v = Number(r.factors[factor.id]);
            if (v > mid + 1e-6) { highSum += Number(r.responses[activeResponse.id]); highCount++; }
            else if (v < mid - 1e-6) { lowSum += Number(r.responses[activeResponse.id]); lowCount++; }
        });
        effects.push({
            factor, effect: effectVal, absEffect: Math.abs(effectVal),
            direction: effectVal >= 0 ? 'Positive' : 'Negative',
            lowAvg: lowCount > 0 ? lowSum / lowCount : 0,
            highAvg: highCount > 0 ? highSum / highCount : 0,
            highCount, lowCount, betaIdx, isAliased, isExcluded, id: factor.id
        });`;

const replaceEffects = `        let highSum = 0, highCount = 0;
        let lowSum = 0, lowCount = 0;
        let centerSum = 0, centerCount = 0;
        const mid = (factor.min + factor.max) / 2;
        validRuns.forEach(r => {
            const v = Number(r.factors[factor.id]);
            if (v > mid + 1e-6) { highSum += Number(r.responses[activeResponse.id]); highCount++; }
            else if (v < mid - 1e-6) { lowSum += Number(r.responses[activeResponse.id]); lowCount++; }
            else { centerSum += Number(r.responses[activeResponse.id]); centerCount++; }
        });
        effects.push({
            factor, effect: effectVal, absEffect: Math.abs(effectVal),
            direction: effectVal >= 0 ? 'Positive' : 'Negative',
            lowAvg: lowCount > 0 ? lowSum / lowCount : null,
            centerAvg: centerCount > 0 ? centerSum / centerCount : null,
            highAvg: highCount > 0 ? highSum / highCount : null,
            highCount, lowCount, centerCount, betaIdx, isAliased, isExcluded, id: factor.id
        });`;

content = content.replace(searchEffects, replaceEffects);

// Effect Summary Logworth
const searchLogworth = `            const logworth = pVal > 0 ? -Math.log10(pVal) : 0;
            effectSummary.push({ name: termName, logworth, pVal, isExcluded: false, isAliased: aliased[i], ss });`;
const replaceLogworth = `            const logworth = pVal > 0 ? -Math.log10(pVal) : 0;
            effectSummary.push({ name: termName, logworth, pVal, isExcluded: false, isAliased: aliased[i], ss });`;

// Actually we don't need to change analysisCore.ts for logworth, it's already there (`logworth` is passed in `effectSummary`).
// We just need to display it in htmlExport.ts and ProjectAnalysis.tsx.

fs.writeFileSync('src/utils/analysisCore.ts', content);
