const fs = require('fs');

let pa = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1. Half-Normal Plot Y-Axis
pa = pa.replace(
  `label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#334155' }}`,
  `label={{ value: 'Half-Normal % Probability', angle: -90, position: 'center', dx: -15, fontSize: 11, fill: '#334155' }}`
);

// 2. DOE Mean Plot Y-Axis
pa = pa.replace(
  `label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }}`,
  `label={{ value: 'Mean Response', angle: -90, position: 'center', dx: -15, fontSize: 10 }}`
);

// 3. Interaction Plot Legend & XAxis
pa = pa.replace(
  `<Legend wrapperStyle={{fontSize: '11px'}} />`,
  `<Legend verticalAlign="top" wrapperStyle={{fontSize: '11px', paddingBottom: '15px'}} />`
);
pa = pa.replace(
  `height={45} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -5, fontSize: 10 }}`,
  `height={40} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -5, fontSize: 10 }}`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', pa);


let rp = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

// 4. Actual by Predicted Y-Axis
rp = rp.replace(
  `label={{ value: 'Actual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }}`,
  `label={{ value: 'Actual', angle: -90, position: 'center', dx: -15, fontSize: 10 }}`
);

// 5. Studentized Residuals Y-Axis
rp = rp.replace(
  `label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }}`,
  `label={{ value: 'Studentized Residual', angle: -90, position: 'center', dx: -15, fontSize: 10 }}`
);

fs.writeFileSync('src/components/ResidualsPlots.tsx', rp);
