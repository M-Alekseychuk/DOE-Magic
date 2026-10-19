import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const anchor = `<h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Lack Of Fit</h3>`;

const insert = `          <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 mt-4">Parameter Estimates</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                <tr>
                  <th className="px-1 py-1 border border-slate-200">Term</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">Estimate</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">Std Error</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">t Ratio</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">Prob &gt; |t|</th>
                </tr>
              </thead>
              <tbody>
                {analysisResults?.parameterEstimates?.filter((pe: any) => !pe.isAliased).map((pe: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-1 py-0.5">{pe.term}</td>
                    <td className="px-1 py-0.5 text-right font-mono">{pe.estimate.toFixed(5)}</td>
                    <td className="px-1 py-0.5 text-right font-mono">{pe.stdError.toFixed(6)}</td>
                    <td className="px-1 py-0.5 text-right font-mono">{pe.tRatio.toFixed(2)}</td>
                    <td className={\`px-1 py-0.5 text-right font-mono \${pe.pVal <= 0.05 ? 'text-red-700 dark:text-red-400' : ''}\`}>
                      {pe.pVal < 0.0001 ? '<.0001*' : (pe.pVal <= 0.05 ? pe.pVal.toFixed(4) + '*' : pe.pVal.toFixed(4))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 mt-4">Effect Tests</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                <tr>
                  <th className="px-1 py-1 border border-slate-200">Source</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">Nparm</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">DF</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">Sum of Squares</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">F Ratio</th>
                  <th className="px-1 py-1 border border-slate-200 text-right">Prob &gt; F</th>
                </tr>
              </thead>
              <tbody>
                {analysisResults?.effectSummary?.filter((ef: any) => !ef.isExcluded && !ef.isAliased).map((ef: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-1 py-0.5">{ef.name}</td>
                    <td className="px-1 py-0.5 text-right">1</td>
                    <td className="px-1 py-0.5 text-right">1</td>
                    <td className="px-1 py-0.5 text-right font-mono">{ef.ss.toFixed(6)}</td>
                    <td className="px-1 py-0.5 text-right font-mono">{ef.fRatio.toFixed(4)}</td>
                    <td className={\`px-1 py-0.5 text-right font-mono \${ef.pVal <= 0.05 ? 'text-red-700 dark:text-red-400' : ''}\`}>
                      {ef.pVal < 0.0001 ? '<.0001*' : (ef.pVal <= 0.05 ? ef.pVal.toFixed(4) + '*' : ef.pVal.toFixed(4))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>\n\n` + anchor;

code = code.replace(anchor, insert);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
