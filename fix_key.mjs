import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');
code = code.replace(
    "const key = project.factors.map(f => Number(run.factors[f.id])).join(',');",
    "const key = project.factors.map(f => Number(run.factors[f.id]).toFixed(6)).join(',');"
);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
