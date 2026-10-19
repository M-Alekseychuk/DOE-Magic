import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('>LACK OF FIT<'));
console.log(lines.slice(start - 2, start + 30).join('\n'));
