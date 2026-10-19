import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
const lines = code.split('\n');
console.log("LINE 279");
console.log(lines.slice(270, 290).join('\n'));
console.log("\nLINE 538");
console.log(lines.slice(530, 550).join('\n'));
console.log("\nLINE 1239");
console.log(lines.slice(1230, 1250).join('\n'));
