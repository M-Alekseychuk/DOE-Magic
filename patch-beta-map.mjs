import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /\/\/ 3\. Map Beta back to UI objects[\s\S]*?\/\/ 4\. Calculate SSE, SST, and R-squared based on the exact OLS model/m;
const newBetaLogic = `// 3. Map Beta back to UI objects
    const effects: any[] = [];
    const interactions: any[] = [];
    
    // We will still build ALL effects and interactions for the UI,
    // but if they are excluded, we set their effect to 0 and mark them excluded.
    
    for (let i = 0; i < k; i++) {
        const factor = project.factors[i];
        const termIndex = activeTerms.findIndex(t => t.type === 'main' && t.factor.id === factor.id);
        
        let effectVal = 0;
        let isAliased = false;
        let isExcluded = true;
        let betaIdx = -1;
        
        if (termIndex !== -1) {
            betaIdx = 1 + termIndex;
            effectVal = beta[betaIdx] * 2;
            isAliased = aliased[betaIdx];
            isExcluded = false;
        }

        const mid = (factor.min + factor.max) / 2;
        let highSum = 0, highCount = 0, lowSum = 0, lowCount = 0;
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
        });
    }

    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            const intId = \`\${project.factors[i].id}*\${project.factors[j].id}\`;
            const termIndex = activeTerms.findIndex(t => t.type === 'interaction' && t.id === intId);
            
            let effectVal = 0;
            let isAliased = false;
            let isExcluded = true;
            let betaIdx = -1;
            
            if (termIndex !== -1) {
                betaIdx = 1 + termIndex;
                effectVal = beta[betaIdx] * 2;
                isAliased = aliased[betaIdx];
                isExcluded = false;
            }

            interactions.push({
                f1: project.factors[i],
                f2: project.factors[j],
                id: intId,
                effect: effectVal, absEffect: Math.abs(effectVal),
                direction: effectVal >= 0 ? 'Positive' : 'Negative',
                betaIdx, isAliased, isExcluded
            });
        }
    }

    // 4. Calculate SSE, SST, and R-squared based on the exact OLS model
`;

code = code.replace(regex, newBetaLogic);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
