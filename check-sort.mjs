import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('effectSummary.sort('));
if (start !== -1) {
  console.log(lines.slice(start - 2, start + 10).join('\n'));
} else {
  console.log('Sort not found');
}
