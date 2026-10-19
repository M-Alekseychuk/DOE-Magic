import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Half-Normal Plot
const targetYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={30}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, dx: -15, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
const replaceYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={30}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, dx: -10, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
content = content.replace(targetYAxis, replaceYAxis);

// DOE Mean Plot
const targetMeanChart = `<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>`;
const replaceMeanChart = `<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 35, bottom: 20 }}>`;
content = content.replace(targetMeanChart, replaceMeanChart);

const targetMeanYAxis = `<YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: -15, fontSize: 10 }} />`;
const replaceMeanYAxis = `<YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} width={30} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: -10, fontSize: 10 }} />`;
content = content.replace(targetMeanYAxis, replaceMeanYAxis);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);

// Residuals Plots
let residuals = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

// Actual by Predicted
residuals = residuals.replace(
    `<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={60} label={{ value: 'Actual', angle: -90, position: 'insideLeft', dx: -20, fontSize: 10 }} />`,
    `<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={35} label={{ value: 'Actual', angle: -90, position: 'insideLeft', dx: -10, fontSize: 10 }} />`
);
residuals = residuals.replace(
    `<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>`,
    `<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>`
);

// Studentized Residuals
residuals = residuals.replace(
    `<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={60} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', dx: -20, fontSize: 10 }} />`,
    `<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={35} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', dx: -10, fontSize: 10 }} />`
);
residuals = residuals.replace(
    `<ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>`,
    `<ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>`
);

fs.writeFileSync('src/components/ResidualsPlots.tsx', residuals);
