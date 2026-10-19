import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('Exclude'));
console.log(lines.slice(start - 5, start + 15).join('\n'));
