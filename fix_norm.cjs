const fs = require('fs');

let pa = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const start = pa.indexOf('function normSInv(p: number): number {');
const end = pa.indexOf('  return x;\n}') + '  return x;\n}'.length;

const funcBody = pa.substring(start, end);
pa = pa.substring(0, start) + pa.substring(end);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', pa);

let core = fs.readFileSync('src/utils/analysisCore.ts', 'utf8');
core = core.replace('// Matrix math utilities for OLS', funcBody + '\n\n// Matrix math utilities for OLS');
fs.writeFileSync('src/utils/analysisCore.ts', core);
