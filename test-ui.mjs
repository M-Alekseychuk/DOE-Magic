import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const tableStart = lines.findIndex(l => l.includes('Effect Summary'));
console.log(lines.slice(tableStart, tableStart + 50).join('\n'));
