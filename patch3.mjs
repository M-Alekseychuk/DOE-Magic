import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

content = content.replace(
  'grid grid-cols-2 gap-4 mb-4 border-b border-slate-800 pb-4',
  'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 border-b border-slate-800 pb-4' // actually it was already grid-cols-2. Let's make it max-w-sm
);

content = content.replace(
  '<div className="grid grid-cols-2 gap-4 mb-4 border-b border-slate-800 pb-4">',
  '<div className="max-w-xs mb-4 border-b border-slate-800 pb-4">'
);

fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
console.log('done 5');
