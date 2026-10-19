import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('Exclude'));
console.log(lines.slice(start - 10, start + 10).join('\n'));
