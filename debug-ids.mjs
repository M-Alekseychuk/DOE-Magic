import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /setExcludedTerms\(prev => prev\.filter\(id => id !== ef\.id\)\);/,
  `console.log("Removing:", ef.id, "from:", prev); setExcludedTerms(prev => prev.filter(id => id !== ef.id));`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
