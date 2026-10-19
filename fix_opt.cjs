const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

// 1. Container
content = content.replace(
  'className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-4 flex flex-col text-white"',
  'className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-4 flex flex-col text-slate-800 dark:text-slate-200"'
);

// 2. Icon bg
content = content.replace(
  'className="p-1 bg-amber-500 rounded-sm"',
  'className="p-1 bg-amber-100 dark:bg-amber-500 rounded-sm"'
);
content = content.replace(
  'className="text-slate-900 dark:text-slate-100"',
  'className="text-amber-700 dark:text-slate-100"'
);

// 3. Subtitles
content = content.replace(
  /<p className="text-\[10px\] text-slate-400 mt-0\.5">/g,
  '<p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">'
);

// 4. labels
content = content.replace(
  /text-slate-400 font-bold uppercase/g,
  'text-slate-500 dark:text-slate-400 font-bold uppercase'
);
content = content.replace(
  /<label className="text-\[10px\] font-bold uppercase tracking-widest text-slate-400">/g,
  '<label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">'
);
content = content.replace(
  /<h4 className="text-\[10px\] font-bold text-slate-400 uppercase tracking-widest">/g,
  '<h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">'
);

// 5. Inputs
content = content.replace(
  /className="w-12 px-1 py-1 rounded bg-slate-800 border border-slate-700 text-\[11px\] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-center"/g,
  'className="w-12 px-1 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-center"'
);

content = content.replace(
  /className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-\[11px\] rounded px-2 py-1\.5 focus:outline-none focus:ring-1 focus:ring-blue-500"/g,
  'className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"'
);

// 6. borders
content = content.replace(
  /border-b border-slate-800/g,
  'border-b border-slate-200 dark:border-slate-800'
);
content = content.replace(
  /border-t border-slate-800/g,
  'border-t border-slate-200 dark:border-slate-800'
);

// 7. description text
content = content.replace(
  /<div className="mb-4 space-y-2 text-slate-400 text-\[10px\] leading-relaxed border-b border-slate-200 dark:border-slate-800 pb-4">/g,
  '<div className="mb-4 space-y-2 text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed border-b border-slate-200 dark:border-slate-800 pb-4">'
);

// 8. Prose
content = content.replace(
  /className="prose prose-sm prose-invert max-w-none text-\[11px\] prose-p:leading-relaxed"/g,
  'className="prose prose-sm dark:prose-invert prose-slate max-w-none text-[11px] prose-p:leading-relaxed"'
);

// 9. placeholder bg
content = content.replace(
  /className="py-8 text-center text-\[11px\] text-slate-500 dark:text-slate-300 bg-slate-800\/50 rounded border border-dashed border-slate-700"/g,
  'className="py-8 text-center text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded border border-dashed border-slate-300 dark:border-slate-700"'
);

fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
