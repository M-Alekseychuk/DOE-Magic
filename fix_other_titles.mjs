import fs from 'fs';
import path from 'path';

const files = [
  'src/components/PredictionProfiler.tsx',
  'src/components/ResidualsPlots.tsx',
  'src/components/ProjectSetup.tsx',
  'src/components/ProjectOptimization.tsx',
  'src/components/RobustnessSimulation.tsx',
  'src/components/Layout.tsx',
  'src/components/DesignCube.tsx',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1"
  content = content.replaceAll(
    'className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1"',
    'className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1"'
  );

  // className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
  content = content.replaceAll(
    'className="text-[10px] font-bold uppercase tracking-widest text-slate-400"',
    'className="text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-blue-400"'
  );

  // Layout current experiment title
  content = content.replace(
    'className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-1"',
    'className="text-[11px] uppercase tracking-widest font-bold text-brand-700 dark:text-blue-400 mb-1"'
  );

  fs.writeFileSync(file, content);
}

