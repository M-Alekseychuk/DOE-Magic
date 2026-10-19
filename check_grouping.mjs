import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('const uniqueRuns = new Map<string, number[]>();'));
console.log(lines.slice(start, start + 30).join('\n'));
