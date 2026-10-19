import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const starts = [];
lines.forEach((l, i) => { if (l.includes('.isExcluded')) starts.push(i); });
starts.forEach(i => console.log(lines[i]));
