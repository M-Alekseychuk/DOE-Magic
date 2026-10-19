import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const match = code.match(/activeTerms\.push\(\{ type: 'main'[\s\S]*?\}\);/m);
console.log(match ? match[0] : "Not found");
