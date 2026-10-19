import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

content = content.replaceAll(
  'className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 cursor-pointer',
  'className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-2 cursor-pointer'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);

