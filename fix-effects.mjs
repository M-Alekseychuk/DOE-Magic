import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regexEff = /const effects = project\.factors\.map\(\(f, i\) => \(\{[\s\S]*?\}\)\);/m;
const replacerEff = `const effects = project.factors.map((f, i) => ({
      factor: f,
      effect: beta[1 + i] * 2, // main effect is 2 * beta
      absEffect: Math.abs(beta[1 + i] * 2),
      direction: beta[1 + i] >= 0 ? 'positive' : 'negative',
      isAliased: aliasedTerms.has(1 + i),
      betaIdx: 1 + i,
      id: f.id,
      isExcluded: excludedTerms.includes(f.id)
    }));`;
code = code.replace(regexEff, replacerEff);

const regexInt = /const interactions: any\[\] = \[\];[\s\S]*?\}\s*\}/m;
const replacerInt = `const interactions: any[] = [];
    for (let i = 0; i < project.factors.length; i++) {
      for (let j = i + 1; j < project.factors.length; j++) {
        interactions.push({
          f1: project.factors[i],
          f2: project.factors[j],
          effect: beta[k_main + 1 + interactions.length] * 2,
          absEffect: Math.abs(beta[k_main + 1 + interactions.length] * 2),
          direction: beta[k_main + 1 + interactions.length] >= 0 ? 'positive' : 'negative',
          isAliased: aliasedTerms.has(k_main + 1 + interactions.length),
          betaIdx: k_main + 1 + interactions.length,
          id: project.factors[i].id + '*' + project.factors[j].id,
          isExcluded: excludedTerms.includes(project.factors[i].id + '*' + project.factors[j].id)
        });
      }
    }`;
code = code.replace(regexInt, replacerInt);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
