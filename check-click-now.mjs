import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const match = code.match(/onClick=\{\(e\) => \{[\s\S]*?\}\}/m);
console.log(match ? match[0] : "Not found");
