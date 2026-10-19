const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// text-slate-400 headers
content = content.replace(
  'className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2"',
  'className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 mb-2"'
);
content = content.replace(
  'className="text-slate-400 border-b border-slate-800 font-mono text-[9px] uppercase tracking-wider"',
  'className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono text-[9px] uppercase tracking-wider"'
);

// Tr dividers
content = content.replace(
  'className="divide-y divide-slate-800/60 font-mono"',
  'className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono"'
);
content = content.replace(
  'className="hover:bg-slate-800/30 transition-colors"',
  'className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"'
);

// Factor Names
content = content.replace(
  'className="py-2.5 text-white font-sans font-medium"',
  'className="py-2.5 text-slate-800 dark:text-white font-sans font-medium"'
);

// Experimental Range
content = content.replace(
  'className="py-2.5 text-center text-slate-400 text-[10px]"',
  'className="py-2.5 text-center text-slate-500 dark:text-slate-400 text-[10px]"'
);

// Coded Setting
content = content.replace(
  'className="inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-300 text-[10px] font-semibold"',
  'className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-blue-700 dark:text-blue-300 text-[10px] font-semibold"'
);

// Optimal Operating Value
content = content.replace(
  'className="inline-block font-bold text-emerald-600 dark:text-emerald-400 bg-slate-800/90 border border-slate-700 px-2 py-0.5 rounded text-xs"',
  'className="inline-block font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded text-xs shadow-sm"'
);

// Marginal Sensitivity
content = content.replace(
  "text-slate-400 bg-slate-800/40",
  "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40"
);
content = content.replace(
  "text-emerald-300 bg-emerald-950/40 border border-emerald-800/40",
  "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40"
);
content = content.replace(
  "text-amber-300 bg-amber-950/40 border border-amber-800/40",
  "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40"
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
