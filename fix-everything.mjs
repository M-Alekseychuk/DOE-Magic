import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Fix Effects array
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

// Fix Interactions array
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

// Fix Table html structure and sizes
// The Effect Summary Table
const regexTable = /\{analysisResults\?\.effectSummary\?\.map\(\(ef: any, idx: number\) => \([\s\S]*?<\/tr>\s*\)\)\}/m;
const cleanCode = `{analysisResults?.effectSummary?.map((ef: any, idx: number) => (
                  <tr key={idx} className={\`border-b border-slate-100 \${ef.isExcluded ? 'bg-slate-50 dark:bg-slate-800/50' : ''}\`}>
                    
                    <td className="px-1 py-0.5 font-medium">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            if (ef.isExcluded) {
                              setExcludedTerms(prev => prev.filter(id => id !== ef.id));
                            } else {
                              setExcludedTerms(prev => [...prev, ef.id]);
                            }
                          }}
                          className={\`text-[9px] px-1 py-0 border rounded shadow-sm transition-colors \${ef.isExcluded ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-900/30 border-b-2 hover:border-brand-300 dark:hover:border-brand-700'}\`}
                        >
                          {ef.isExcluded ? 'Include' : 'Exclude'}
                        </button>
                        <span className={ef.isExcluded ? 'line-through text-slate-400 font-normal' : ''}>{ef.name}</span>
                      </div>
                    </td>
                    <td className="px-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-right font-mono">{ef.logworth.toFixed(3)}</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden relative">
                          <div className="h-full bg-slate-300" style={{ width: \`\${Math.min(100, ef.logworth * 10)}%\` }}></div>
                          {ef.logworth >= -Math.log10(0.05) && <div className="absolute top-0 bottom-0 border-l border-blue-500" style={{ left: '13.01%' }}></div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-0.5 text-right font-mono">{ef.pVal.toFixed(5)}</td>
                  </tr>
                ))}`;

code = code.replace(regexTable, cleanCode);

// Fix table headers sizes for compact mode
code = code.replace(/<th className="px-2 py-1 /g, '<th className="px-1 py-1 ');
// Compact Lack Of Fit table
code = code.replace(/<td className="px-2 py-1">/g, '<td className="px-1 py-0.5">');
code = code.replace(/<td className="px-2 py-1 text-right/g, '<td className="px-1 py-0.5 text-right');
code = code.replace(/<th className="px-2 py-1/g, '<th className="px-1 py-1');

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
