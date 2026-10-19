import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1) Fix Y-axis label being cut off by adding more left margin to the scatter chart
const targetChart = `<ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>`;
const replaceChart = `<ScatterChart margin={{ top: 10, right: 30, left: 30, bottom: 20 }}>`;
content = content.replace(targetChart, replaceChart);

// 2) Update Legends
const targetParetoLegend = `{effectsPlotType === 'pareto' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/10"></div> Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/10"></div> Significant (Negative)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/10"></div> Not Sig (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/10"></div> Not Sig (Negative)</div>
            </div>
          )}`;
const replacementParetoLegend = `{effectsPlotType === 'pareto' && (
            <div className="flex flex-col gap-2 mt-4 items-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold">
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/10"></div> Significant (Positive)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/10"></div> Significant (Negative)</div>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/10"></div> Not Significant (Positive)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/10"></div> Not Significant (Negative)</div>
              </div>
            </div>
          )}`;
content = content.replace(targetParetoLegend, replacementParetoLegend);


const targetHNLegend = `{effectsPlotType === 'half-normal' && (
            <div className="flex gap-4 mt-2 justify-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/20"></div> Significant (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/20"></div> Significant (Negative)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/20"></div> Not Sig (Positive)</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/20"></div> Not Sig (Negative)</div>
            </div>
          )}`;
const replacementHNLegend = `{effectsPlotType === 'half-normal' && (
            <div className="flex flex-col gap-2 mt-4 items-center text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-300 font-bold">
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-900/20"></div> Significant (Positive)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-900/20"></div> Significant (Negative)</div>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-sky-200 rounded-sm border border-slate-900/20"></div> Not Significant (Positive)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-200 rounded-sm border border-slate-900/20"></div> Not Significant (Negative)</div>
              </div>
            </div>
          )}`;
content = content.replace(targetHNLegend, replacementHNLegend);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed UI elements');
