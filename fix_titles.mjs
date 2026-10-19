import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1) Text
content = content.replace(
  'Empirical OLS response surface optimization (JMP / Design-Expert Standard)',
  'Empirical OLS response surface optimization'
);

// 2) Dropdown colour
content = content.replace(
  'className="bg-blue-800/50 hover:bg-blue-700/50 border border-blue-600/60 text-blue-100 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400 rounded pl-2 pr-5 py-0.5 appearance-none cursor-pointer transition-colors"',
  'className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400 rounded pl-2 pr-5 py-0.5 appearance-none cursor-pointer transition-colors"'
);

// 3) Module background
content = content.replace(
  'className="lg:col-span-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm flex flex-col text-slate-800 dark:text-slate-700 dark:text-slate-200"',
  'className="lg:col-span-2 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-5 shadow-sm flex flex-col text-slate-800 dark:text-slate-200"'
);

// 4) Module titles

// "Predictive Model: Optimal Conditions"
// text-[11px] uppercase tracking-wider font-bold text-brand-700 dark:text-blue-600 dark:text-blue-400
// Wait, already blue. But let's standardize to:
// text-[11px] uppercase tracking-wider font-bold text-brand-700 dark:text-blue-400

content = content.replace(
  'className="text-[11px] uppercase tracking-wider font-bold text-brand-700 dark:text-blue-600 dark:text-blue-400"',
  'className="text-[11px] uppercase tracking-wider font-bold text-brand-700 dark:text-blue-400"'
);

content = content.replace(
  'className="text-[11px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-500 dark:text-slate-300 flex items-center gap-1.5 mb-1"',
  'className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 flex items-center gap-1.5 mb-1"'
);

// Replace all instances of:
// className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1"
// with className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1"
content = content.replaceAll(
  'className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1"',
  'className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1"'
);

// className="text-[10px] uppercase tracking-widest font-bold text-slate-400"
content = content.replaceAll(
  'className="text-[10px] uppercase tracking-widest font-bold text-slate-400"',
  'className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400"'
);


fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);

