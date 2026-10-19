import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
code = code.replace(
  "onClick={() => {",
  "onClick={() => {\n                          console.log('Clicked!', ef.id, ef.isExcluded, excludedTerms);"
);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
