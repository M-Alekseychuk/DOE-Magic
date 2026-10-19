const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Container
content = content.replace(
  'className="lg:col-span-2 bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-lg p-5 shadow-sm flex flex-col text-white"',
  'className="lg:col-span-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm flex flex-col text-slate-800 dark:text-slate-200"'
);

// Header elements
content = content.replace(
  'className="text-[11px] uppercase tracking-wider font-bold text-blue-400"',
  'className="text-[11px] uppercase tracking-wider font-bold text-brand-700 dark:text-blue-400"'
);
content = content.replace(
  'className="text-[11px] text-slate-300 mt-0.5"',
  'className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5"'
);
content = content.replace(
  'border-b border-slate-800',
  'border-b border-slate-200 dark:border-slate-800'
);

// Goal selection
content = content.replace(
  'bg-blue-900/40 border border-blue-700/60 rounded',
  'bg-slate-100 dark:bg-blue-900/40 border border-slate-300 dark:border-blue-700/60 rounded'
);
content = content.replace(
  /<span className="text-blue-300 font-semibold uppercase tracking-wider">Goal:<\/span>/g,
  '<span className="text-slate-600 dark:text-blue-300 font-semibold uppercase tracking-wider">Goal:</span>'
);
content = content.replace(
  /<span className="text-blue-300 font-semibold uppercase tracking-wider hidden sm:inline">\{activeResponse\?\.name\}<\/span>/g,
  '<span className="text-slate-600 dark:text-blue-300 font-semibold uppercase tracking-wider hidden sm:inline">{activeResponse?.name}</span>'
);
content = content.replace(
  'bg-blue-800/50 hover:bg-blue-700/50 border border-blue-600/60 text-blue-100 focus:ring-blue-400',
  'bg-white dark:bg-blue-800/50 hover:bg-slate-50 dark:hover:bg-blue-700/50 border border-slate-300 dark:border-blue-600/60 text-slate-800 dark:text-blue-100 focus:ring-brand-500 dark:focus:ring-blue-400'
);

content = content.replace(
  /<option value="maximize" className="bg-slate-800 text-slate-200">Maximize<\/option>/g,
  '<option value="maximize" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Maximize</option>'
);
content = content.replace(
  /<option value="minimize" className="bg-slate-800 text-slate-200">Minimize<\/option>/g,
  '<option value="minimize" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Minimize</option>'
);
content = content.replace(
  /<option value="target" className="bg-slate-800 text-slate-200">Target<\/option>/g,
  '<option value="target" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Target</option>'
);
content = content.replace(
  'text-blue-300 pointer-events-none',
  'text-slate-500 dark:text-blue-300 pointer-events-none'
);

content = content.replace(
  'border-l border-blue-700/60',
  'border-l border-slate-300 dark:border-blue-700/60'
);
content = content.replace(
  '<span className="text-blue-300 font-semibold uppercase tracking-wider">Value:</span>',
  '<span className="text-slate-600 dark:text-blue-300 font-semibold uppercase tracking-wider">Value:</span>'
);
content = content.replace(
  'bg-blue-950/50 border border-blue-700/60 rounded px-1.5 py-0.5 text-blue-200 font-mono w-16 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[10px]',
  'bg-white dark:bg-blue-950/50 border border-slate-300 dark:border-blue-700/60 rounded px-1.5 py-0.5 text-slate-800 dark:text-blue-200 font-mono w-16 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:focus:ring-blue-500 text-[10px]'
);

// Desirability badge
content = content.replace(
  /'bg-emerald-900\/60 border-emerald-700\/60 text-emerald-200'/g,
  "'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200'"
);
content = content.replace(
  /'bg-blue-900\/60 border-blue-700\/60 text-blue-200'/g,
  "'bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700/60 text-blue-800 dark:text-blue-200'"
);
content = content.replace(
  /'bg-amber-900\/60 border-amber-700\/60 text-amber-200'/g,
  "'bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-200'"
);

// Stat cards (Expected Y, Mean CI, Single PI, Goodness of Fit)
content = content.replace(
  /bg-slate-800\/60 border border-slate-700\/70/g,
  'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70'
);
content = content.replace(
  /text-slate-400 font-semibold mb-1/g,
  'text-slate-500 dark:text-slate-400 font-semibold mb-1'
);
content = content.replace(
  /text-emerald-400/g,
  'text-emerald-600 dark:text-emerald-400'
);
content = content.replace(
  /text-slate-300/g,
  'text-slate-500 dark:text-slate-300'
);
content = content.replace(
  /text-slate-400 mt-1/g,
  'text-slate-500 dark:text-slate-400 mt-1'
);
content = content.replace(
  /text-blue-400/g,
  'text-blue-600 dark:text-blue-400'
);
content = content.replace(
  /text-fuchsia-400/g,
  'text-fuchsia-600 dark:text-fuchsia-400'
);

// Goodness of Fit specifically
content = content.replace(
  /text-slate-200/g,
  'text-slate-700 dark:text-slate-200'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
