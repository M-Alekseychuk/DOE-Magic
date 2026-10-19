import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('grid-cols-1 lg:grid-cols-2'));
if (start !== -1) {
    console.log(lines.slice(start - 2, start + 30).join('\n'));
} else {
    const backup = lines.findIndex(l => l.includes('grid-cols'));
    console.log(lines.slice(backup - 2, backup + 30).join('\n'));
}
