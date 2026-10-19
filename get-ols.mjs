import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('// 2. Perform Robust OLS solving'));
console.log(lines.slice(start - 2, start + 80).join('\n'));
