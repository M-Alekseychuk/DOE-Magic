import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /activeTerms\.push\(\{ type: 'main', factor: project\.factors\[i\], idx: i \}\);/g,
  "activeTerms.push({ type: 'main', factor: project.factors[i], idx: i, id: project.factors[i].id });"
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
