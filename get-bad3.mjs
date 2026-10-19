import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
console.log(lines.slice(265, 300).join('\n'));
