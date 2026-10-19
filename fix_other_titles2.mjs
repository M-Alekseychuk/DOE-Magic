import fs from 'fs';

let optContent = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');
optContent = optContent.replace(
  'className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"',
  'className="text-[11px] font-bold text-brand-700 dark:text-blue-400 uppercase tracking-widest"'
);
fs.writeFileSync('src/components/ProjectOptimization.tsx', optContent);

let robContent = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');
robContent = robContent.replace(
  'className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest"',
  'className="text-[11px] font-bold text-brand-700 dark:text-blue-400 uppercase tracking-widest"'
);
fs.writeFileSync('src/components/RobustnessSimulation.tsx', robContent);

