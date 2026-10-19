import fs from 'fs';
let residuals = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

residuals = residuals.replace(
    `label={{ value: 'Actual', angle: -90, position: 'insideLeft', dx: -10, fontSize: 10 }}`,
    `label={{ value: 'Actual', angle: -90, position: 'insideLeft', dx: 0, fontSize: 10 }}`
);

residuals = residuals.replace(
    `label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', dx: -10, fontSize: 10 }}`,
    `label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', dx: 0, fontSize: 10 }}`
);

fs.writeFileSync('src/components/ResidualsPlots.tsx', residuals);
