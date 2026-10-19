import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /const runGroups: Record<string, number\[\]> = \{\};\s*validRuns\.forEach\(run => \{\s*const key = project\.factors\.map\(f => Number\(run\.factors\[f\.id\]\)\.toFixed\(6\)\)\.join\(','\);\s*if \(\!runGroups\[key\]\) runGroups\[key\] = \[\];\s*runGroups\[key\]\.push\(Number\(run\.responses\[activeResponse\.id\]\)\);\s*\}\);/m;

const newGroupingLogic = `
    const runGroups: Record<string, number[]> = {};
    
    // Determine which factors are active in the model
    const activeFactorIds = new Set<string>();
    activeTerms.forEach(t => {
        if (t.type === 'main') activeFactorIds.add(t.factor.id);
        if (t.type === 'interaction') {
            activeFactorIds.add(t.f1.id);
            activeFactorIds.add(t.f2.id);
        }
    });

    validRuns.forEach(run => {
        const key = project.factors
            .filter(f => activeFactorIds.has(f.id))
            .map(f => Number(run.factors[f.id]).toFixed(6))
            .join(',');
        
        // If there are NO active factors (e.g. only intercept), all runs are grouped together
        const finalKey = key || 'intercept_only';
        
        if (!runGroups[finalKey]) runGroups[finalKey] = [];
        runGroups[finalKey].push(Number(run.responses[activeResponse.id]));
    });
`;

code = code.replace(regex, newGroupingLogic);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
