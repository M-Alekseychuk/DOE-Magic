import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /const addTermToSummary = \(name: string, betaIdx: number, effectValue: number, isAliased: boolean\) => \{[\s\S]*?interactions\.forEach\(int => addTermToSummary\(`\$\{int\.f1\.name\}\*\$\{int\.f2\.name\}`, int\.betaIdx, int\.effect, int\.isAliased\)\);\s*\}/m;

const replacer = `const addTermToSummary = (name: string, betaIdx: number, effectValue: number, isAliased: boolean, isExcluded: boolean, id: string) => {
        let ss = 0;
        let logworth = 0;
        let pVal = 1;
        let fRatio = 0;
        
        if (isAliased) {
            ss = 0;
            pVal = 1;
        } else if (diagInv[betaIdx] > 0 && !isExcluded) {
            ss = Math.pow(beta[betaIdx], 2) / diagInv[betaIdx];
            if (test_df > 0 && test_ms > 0) {
                fRatio = ss / test_ms;
                pVal = 1 - jStat.centralF.cdf(fRatio, 1, test_df);
                if (pVal < 1e-15) pVal = 1e-15;
                logworth = -Math.log10(pVal);
            }
        }
        
        effectSummary.push({ name: name + (isAliased && !isExcluded ? " (Aliased)" : ""), logworth, pVal, ss, fRatio, isAliased, isExcluded, id });
    };

    if (effectsLevelFilter !== 'secondary') {
        effects.forEach(e => addTermToSummary(\`\${e.factor.name}(\${e.factor.min},\${e.factor.max})\`, e.betaIdx, e.effect, e.isAliased, e.isExcluded, e.id));
    }
    if (effectsLevelFilter !== 'primary') {
        interactions.forEach(int => addTermToSummary(\`\${int.f1.name}*\${int.f2.name}\`, int.betaIdx, int.effect, int.isAliased, int.isExcluded, int.id));
    }`;

code = code.replace(regex, replacer);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
