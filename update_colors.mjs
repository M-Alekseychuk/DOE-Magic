import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Colors
const sigPos = "#2563eb"; // Blue
const sigNeg = "#dc2626"; // Red
const notSigPos = "#bae6fd"; // Light blue (pastel)
const notSigNeg = "#fecaca"; // Light red (pastel)

// Update Pareto Chart colors
const paretoTarget = `<Bar dataKey="tRatio" name="t-Ratio" radius={[0, 4, 4, 0]}>
                      {analysisResults.paretoData.map((entry: any, index: number) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.direction === 'Positive' ? '#3b82f6' : '#ef4444'} />
                      ))}
                    </Bar>`;

const paretoReplacement = `<Bar dataKey="tRatio" name="t-Ratio" radius={[0, 4, 4, 0]}>
                      {analysisResults.paretoData.map((entry: any, index: number) => {
                          const isSig = entry.tRatio > analysisResults.tLimitPareto;
                          let color = isSig ? (entry.direction === 'Positive' ? '${sigPos}' : '${sigNeg}') : (entry.direction === 'Positive' ? '${notSigPos}' : '${notSigNeg}');
                          return <Cell key={\`cell-\${index}\`} fill={color} />;
                      })}
                    </Bar>`;
content = content.replace(paretoTarget, paretoReplacement);

// Update Half-Normal Chart colors
const hnTarget = `<Scatter data={analysisResults.halfNormalData} shape="square" stroke="#000" strokeWidth={0.5}>
                      {analysisResults.halfNormalData.map((entry: any, index: number) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.direction === 'Positive' ? '#f97316' : '#3b82f6'} />
                      ))}
                    </Scatter>`;

const hnReplacement = `<Scatter data={analysisResults.halfNormalData} shape="square" stroke="#000" strokeWidth={0.5}>
                      {analysisResults.halfNormalData.map((entry: any, index: number) => {
                          let color = entry.significant ? (entry.direction === 'Positive' ? '${sigPos}' : '${sigNeg}') : (entry.direction === 'Positive' ? '${notSigPos}' : '${notSigNeg}');
                          return <Cell key={\`cell-\${index}\`} fill={color} />;
                      })}
                    </Scatter>`;
content = content.replace(hnTarget, hnReplacement);


// Update legends
const legendTargetPareto = `{effectsPlotType === 'pareto' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Positive Effect</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Negative Effect</div>
            </div>
          )}`;
const legendReplacementPareto = `{effectsPlotType === 'pareto' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/10"></div> Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/10"></div> Significant (Negative)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/10"></div> Not Sig (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/10"></div> Not Sig (Negative)</div>
            </div>
          )}`;
content = content.replace(legendTargetPareto, legendReplacementPareto);

const legendTargetHN = `{effectsPlotType === 'half-normal' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Significant (Negative)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-300 rounded-sm"></div> Not Significant</div>
            </div>
          )}`;
          
const legendReplacementHN = `{effectsPlotType === 'half-normal' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/20"></div> Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/20"></div> Significant (Negative)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/20"></div> Not Sig (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/20"></div> Not Sig (Negative)</div>
            </div>
          )}`;
content = content.replace(legendTargetHN, legendReplacementHN);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Colors updated.');
