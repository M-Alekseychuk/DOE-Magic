import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
code = code.replace("r.responses[activeResponse.id] !== ''", "String(r.responses[activeResponse.id]) !== ''");
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
