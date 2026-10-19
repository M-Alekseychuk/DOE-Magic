import fs from 'fs';
let content = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

content = content.replace(/label={{ value: 'Actual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }}/g,
"label={{ value: 'Actual', angle: -90, position: 'insideLeft', dx: -20, fontSize: 10 }}");

content = content.replace(/label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }}/g,
"label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', dx: -20, fontSize: 10 }}");

fs.writeFileSync('src/components/ResidualsPlots.tsx', content);
