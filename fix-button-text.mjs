import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /\{ef\.isExcluded \? 'Include \(' \+ ef\.id \+ '\)' : 'Exclude \(' \+ ef\.id \+ '\)'\}/g,
  `{ef.isExcluded ? 'Include' : 'Exclude'}`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
