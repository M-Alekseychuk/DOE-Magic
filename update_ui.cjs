const fs = require('fs');
let content = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');

const uiStart = content.indexOf('{simulationResults ? (');
const uiEnd = content.indexOf(') : (') + 5; // right before "    <div className=\"flex flex-col items-center justify-center p-12 text-slate-400 bg-white"

if (uiStart === -1 || uiEnd === -1) {
    console.error("Could not find UI block");
    process.exit(1);
}

const newUI = `{simulationResults ? (
          simulationResults.isJoint ? (
            <div className="flex flex-col gap-4">
              <div className={\`p-6 rounded-lg shadow-sm border \${
                simulationResults.defectRate === 0 
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                  : simulationResults.defectRate > 5 
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
              }\`}>
                <div className={\`text-xs uppercase tracking-widest font-bold mb-2 flex items-center gap-1 \${
                  simulationResults.defectRate === 0 ? 'text-emerald-700 dark:text-emerald-400' : simulationResults.defectRate > 5 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                }\`}>
                  <AlertTriangle size={16} /> Joint Defect Rate (OOS in ANY Response)
                </div>
                <div className={\`text-4xl font-bold font-mono \${
                  simulationResults.defectRate === 0 ? 'text-emerald-800 dark:text-emerald-300' : simulationResults.defectRate > 5 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                }\`}>
                  {simulationResults.defectRate.toFixed(2)}%
                </div>
                {simulationResults.defectRate > 0 && (
                  <div className={\`text-xs mt-2 \${simulationResults.defectRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}\`}>
                    {(simulationResults.defectRate / 100 * 1000000).toFixed(0).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")} DPMO
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Response</th>
                      <th className="px-4 py-3 font-semibold text-right">Mean</th>
                      <th className="px-4 py-3 font-semibold text-right">Std Dev (σ)</th>
                      <th className="px-4 py-3 font-semibold text-right">Below LSL</th>
                      <th className="px-4 py-3 font-semibold text-right">Above USL</th>
                      <th className="px-4 py-3 font-semibold text-right">Defect Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {project.responses.map(r => {
                      const stats = simulationResults.individualStats?.[r.id];
                      if (!stats) return null;
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{stats.mean.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right font-mono">{stats.sd.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-500">{stats.belowLSL > 0 ? stats.belowLSL.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-500">{stats.aboveUSL > 0 ? stats.aboveUSL.toLocaleString() : '-'}</td>
                          <td className={\`px-4 py-3 text-right font-mono font-bold \${stats.defectRate > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}\`}>
                            {stats.defectRate.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mb-1">Simulated Mean</div>
                <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                  {simulationResults.mean?.toFixed(3)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mb-1">Simulated standard deviation (σ)</div>
                <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                  {simulationResults.sd?.toFixed(3)}
                </div>
              </div>
              <div className={\`p-4 rounded-lg shadow-sm border \${
                simulationResults.defectRate === 0 
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                  : simulationResults.defectRate > 5 
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
              }\`}>
                <div className={\`text-[10px] uppercase tracking-widest font-bold mb-1 flex items-center gap-1 \${
                  simulationResults.defectRate === 0 ? 'text-emerald-700 dark:text-emerald-400' : simulationResults.defectRate > 5 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                }\`}>
                  <AlertTriangle size={12} /> Defect Rate (OOS)
                </div>
                <div className={\`text-2xl font-bold font-mono \${
                  simulationResults.defectRate === 0 ? 'text-emerald-800 dark:text-emerald-300' : simulationResults.defectRate > 5 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                }\`}>
                  {simulationResults.defectRate?.toFixed(2)}%
                </div>
                {simulationResults.defectRate > 0 && (
                  <div className={\`text-[10px] mt-1 \${simulationResults.defectRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}\`}>
                    {(simulationResults.defectRate / 100 * 1000000).toFixed(0).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")} DPMO
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Response Distribution</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simulationResults.histogram} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="mid" 
                      tickFormatter={(val) => val.toFixed(2)} 
                      tick={{ fontSize: 11 }} 
                      type="number"
                      domain={['dataMin', 'dataMax']}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ fontSize: '11px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                      labelFormatter={(val) => \`Response: ~\${Number(val).toFixed(2)}\`}
                    />
                    <Bar dataKey="count" fill="#0c75b3" radius={[2, 2, 0, 0]} />
                    {simulationResults.lsl !== null && (
                      <ReferenceLine x={simulationResults.lsl} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'LSL', position: 'top', fill: '#ef4444', fontSize: 11 }} />
                    )}
                    {simulationResults.usl !== null && (
                      <ReferenceLine x={simulationResults.usl} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'USL', position: 'top', fill: '#ef4444', fontSize: 11 }} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                {simulationResults.lsl !== null && (
                   <div className="text-[11px] text-slate-500">
                     <span className="font-bold text-red-500">Below LSL:</span> {simulationResults.belowLSL?.toLocaleString()} runs
                   </div>
                )}
                {simulationResults.usl !== null && (
                   <div className="text-[11px] text-slate-500">
                     <span className="font-bold text-red-500">Above USL:</span> {simulationResults.aboveUSL?.toLocaleString()} runs
                   </div>
                )}
              </div>
            </div>
          </>
          )
        ) : (`;

content = content.substring(0, uiStart) + newUI + content.substring(uiEnd - 5);

fs.writeFileSync('src/components/RobustnessSimulation.tsx', content);
