import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /const addTermToSummary = \(name: string, betaIdx: number, effectVal: number, isAliased: boolean\) => \{/m;
const match = code.match(regex);
if (match) {
  console.log("Found addTermToSummary");
}
