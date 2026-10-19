import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('{ef.isExcluded ? \'Include\' : \'Exclude\'}'));
console.log(lines.slice(start - 10, start + 5).join('\n'));
