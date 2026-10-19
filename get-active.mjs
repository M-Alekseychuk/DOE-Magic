import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('const activeTerms'));
console.log(lines.slice(start - 2, start + 20).join('\n'));
