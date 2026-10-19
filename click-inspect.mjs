import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regexTable = /onClick=\{\(e\) => \{[\s\S]*?\}\}/m;
const match = code.match(regexTable);
console.log(match ? match[0] : "Not found");
