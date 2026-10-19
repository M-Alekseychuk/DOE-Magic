import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /<h3 className="text-\[10px\] uppercase tracking-widest font-bold text-slate-400 mb-4">Descriptive Statistics<\/h3>/,
  `<h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-4">Descriptive Statistics</h3>
          <div className="bg-red-100 p-2 text-xs font-mono">DEBUG excludedTerms: {JSON.stringify(excludedTerms)}</div>
          <div className="bg-blue-100 p-2 text-xs font-mono">DEBUG activeTerms: {JSON.stringify(activeTerms.map(t => t.id))}</div>`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
