import fs from 'fs';

let content = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

const target = `  const limit = studentizedResiduals[0]?.limit || 2.5;

  return (
    <div id="studentized-residuals" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 relative group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Studentized Residuals</h3>
          <p className="text-[10px] text-slate-500">Detects outliers. Points beyond the red limits may require investigation.</p>
        </div>
        <button onClick={handleDownload} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all" title="Download PNG">
          <Download size={14} />
        </button>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} label={{ value: 'Run Number', position: 'insideBottom', offset: -10, fontSize: 10 }} />
            <YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-Math.max(limit + 1, 4), Math.max(limit + 1, 4)]} tick={{fontSize: 10}} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} />
            <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px'}} formatter={(value: number) => value ? value.toFixed(3) : 'N/A'} />
            <Scatter name="Runs" data={studentizedResiduals} fill="#3b82f6" />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <ReferenceLine y={limit} stroke="#ef4444" strokeDasharray="3 3" />
            <ReferenceLine y={-limit} stroke="#ef4444" strokeDasharray="3 3" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );`;

const replacement = `  const limit = studentizedResiduals[0]?.limit || 2.5;
  const bonferroniLimit = studentizedResiduals[0]?.bonferroniLimit || limit + 1;
  const maxAbsResid = Math.max(...studentizedResiduals.map(d => Math.abs(d.studentized || 0)));
  const yMax = Math.max(bonferroniLimit + 0.5, maxAbsResid + 0.5, 4);

  return (
    <div id="studentized-residuals" className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 relative group flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Studentized Residuals</h3>
          <p className="text-[10px] text-slate-500">Detects outliers. Points beyond the red limits may require investigation.</p>
        </div>
        <button onClick={handleDownload} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all" title="Download PNG">
          <Download size={14} />
        </button>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} label={{ value: 'Run Number', position: 'insideBottom', offset: -10, fontSize: 10 }} />
            <YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} />
            <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px'}} formatter={(value: number) => value ? value.toFixed(3) : 'N/A'} />
            <Scatter name="Runs" data={studentizedResiduals} fill="#1e293b" />
            <ReferenceLine y={0} stroke="#3b82f6" />
            <ReferenceLine y={limit} stroke="#22c55e" />
            <ReferenceLine y={-limit} stroke="#22c55e" />
            <ReferenceLine y={bonferroniLimit} stroke="#ef4444" />
            <ReferenceLine y={-bonferroniLimit} stroke="#ef4444" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[9px] text-slate-500">
        Externally studentized residuals with 95% simultaneous limits (Bonferroni) in red, individual limits in green.
      </div>
    </div>
  );`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/ResidualsPlots.tsx', content);
    console.log("Fixed Residuals Plots");
} else {
    console.log("Target not found");
}
