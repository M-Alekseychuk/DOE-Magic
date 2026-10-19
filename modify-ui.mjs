import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1. Add state for plot type
if (!code.includes('const [effectsPlotType')) {
    code = code.replace(
        "const [activeResponseId, setSelectedResponseId] = useState",
        "const [effectsPlotType, setEffectsPlotType] = useState<'pareto' | 'half-normal'>('pareto');\n  const [activeResponseId, setSelectedResponseId] = useState"
    );
}

// 2. We need to replace the entire section for Pareto and Half-Normal Plots.
// We'll replace from `{/* Pareto Chart */}` to the end of `{/* Half Normal Plot */}` div.
const startMarker = '{/* Pareto Chart */}';
const nextMarker = '{/* Predictive Model & Optimal Conditions */}'; // Wait, this was moved to the bottom!
const newNextMarker = '{/* Main Effects Plot */}';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(newNextMarker);

if (startIndex > -1 && endIndex > -1) {
    const replacement = `
        {/* Effects Plot (Merged Pareto & Half-Normal) */}
        <div id="effects-plot" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  Effects Plot <span className="normal-case font-normal">({activeResponse?.name})</span>
                </h3>
                <select 
                  value={effectsPlotType}
                  onChange={e => setEffectsPlotType(e.target.value as 'pareto' | 'half-normal')}
                  className="rounded border border-slate-300 dark:border-slate-600 px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="pareto">Pareto: Standardized</option>
                  <option value="half-normal">Half-Normal</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500">
                {effectsPlotType === 'pareto' 
                  ? 'Shows the absolute size of each effect. Bars extending further indicate a stronger impact on the response.' 
                  : 'Helps identify significant effects. Points that deviate furthest from the line represent factors with a meaningful impact.'}
              </p>
            </div>
            <button
              onClick={() => handleDownloadSvg('effects-plot', \`\${project.name}_\${effectsPlotType}_Plot\`)}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Download PNG"
            >
              <Download size={14} />
            </button>
          </div>
          
          <div className="h-64 w-full">
            {effectsPlotType === 'pareto' ? (
              analysisResults?.effects && analysisResults.effects.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysisResults.effects} layout="vertical" margin={{ top: 35, right: 30, left: 40, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="absEffect" name="Absolute Effect" tick={{fontSize: 10}} />
                    <YAxis type="category" dataKey="factor.name" width={80} tick={{fontSize: 10}} />
                    {analysisResults.paretoThreshold > 0 && <ReferenceLine x={analysisResults.paretoThreshold} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Threshold', fill: 'red', fontSize: 10 }} />}
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{fontSize: '11px', borderRadius: '4px'}}
                      formatter={(value: number, name: string, props: any) => [
                        \`\${value.toFixed(3)} (\${props.payload.direction})\`, 
                        'Effect Size'
                      ]}
                    />
                    <Bar dataKey="absEffect" name="Absolute Effect" radius={[0, 4, 4, 0]}>
                      {analysisResults.effects.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.direction === 'Positive' ? '#3ab9a0' : '#0d89d1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No valid run data available.</div>
              )
            ) : (
              analysisResults?.halfNormalData && analysisResults.halfNormalData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="absEffect" name="Absolute Effect" tick={{fontSize: 10}} label={{ value: '|Effect|', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="number" dataKey="expected" name="Half-Normal Quantile" tick={{fontSize: 10}} label={{ value: 'Half-Normal Quantile', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                    <ZAxis type="category" dataKey="factor.name" name="Factor" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{fontSize: '11px', borderRadius: '4px'}}
                      formatter={(value: number, name: string) => name === 'Factor' ? value : value.toFixed(3)}
                    />
                    <Scatter data={analysisResults.halfNormalData} shape="square">
                      {analysisResults.halfNormalData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.significant ? '#3b82f6' : '#cbd5e1'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No valid run data available.</div>
              )
            )}
          </div>
          {effectsPlotType === 'pareto' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-brand-500 rounded-sm"></div> Positive Effect</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-brand-600 rounded-sm"></div> Negative Effect</div>
            </div>
          )}
        </div>

        {/* Effect Summary and ANOVA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Effect Summary</h3>
          <div className="overflow-x-auto flex-1 mb-4">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                <tr>
                  <th className="px-2 py-1 border border-slate-200">Source</th>
                  <th className="px-2 py-1 border border-slate-200 w-32">Logworth</th>
                  <th className="px-2 py-1 border border-slate-200 text-right">PValue</th>
                </tr>
              </thead>
              <tbody>
                {analysisResults?.effectSummary?.map((ef: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-2 py-1 font-medium">{ef.name}</td>
                    <td className="px-2 py-1 flex items-center gap-2">
                      <span className="w-8 text-right font-mono">{ef.logworth.toFixed(3)}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden relative">
                        <div className="h-full bg-slate-300" style={{ width: \`\${Math.min(100, ef.logworth * 10)}%\` }}></div>
                        {ef.logworth >= -Math.log10(0.05) && <div className="absolute top-0 bottom-0 left-[13px] border-l border-blue-500"></div>}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{ef.pVal.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Lack Of Fit</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px] border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                <tr>
                  <th className="px-2 py-1 border border-slate-200">Source</th>
                  <th className="px-2 py-1 border border-slate-200 text-right">DF</th>
                  <th className="px-2 py-1 border border-slate-200 text-right">Sum of Squares</th>
                  <th className="px-2 py-1 border border-slate-200 text-right">Mean Square</th>
                  <th className="px-2 py-1 border border-slate-200 text-right">F Ratio</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-1">Lack Of Fit</td>
                  <td className="px-2 py-1 text-right">{analysisResults?.lackOfFit?.df_lof}</td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.ss_lof.toFixed(6)}</td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.ms_lof.toFixed(6)}</td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.f_lof === Infinity ? 'Inf' : analysisResults?.lackOfFit?.f_lof.toFixed(4)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-1">Pure Error</td>
                  <td className="px-2 py-1 text-right">{analysisResults?.lackOfFit?.df_pure}</td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.ss_pure.toFixed(6)}</td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.ms_pure.toFixed(6)}</td>
                  <td className="px-2 py-1 text-right font-bold text-slate-500">Prob &gt; F</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-1">Total Error</td>
                  <td className="px-2 py-1 text-right">{analysisResults?.lackOfFit?.df_error}</td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.sse.toFixed(6)}</td>
                  <td className="px-2 py-1 text-right"></td>
                  <td className="px-2 py-1 text-right font-mono">{analysisResults?.lackOfFit?.p_lof !== null ? analysisResults?.lackOfFit?.p_lof.toFixed(4) : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        `;
    
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
    console.log("UI merged and Effect Summary added.");
} else {
    console.log("Could not find markers for UI replacement.");
}
