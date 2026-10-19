import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
const start = lines.findIndex(l => l.includes('const analysisResults = useMemo(() => {'));
console.log(lines.slice(start+330, start + 360).join('\n'));
