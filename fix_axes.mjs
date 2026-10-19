import fs from 'fs';
let projectAnalysis = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1. Half-Normal Plot YAxis
let target = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={30}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, dx: -10, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
let replace = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={65}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
projectAnalysis = projectAnalysis.replace(target, replace);

// 1b. Half-Normal Plot Margin
target = `<ScatterChart margin={{ top: 10, right: 30, left: 50, bottom: 20 }}>`;
replace = `<ScatterChart margin={{ top: 10, right: 30, left: 65, bottom: 20 }}>`;
projectAnalysis = projectAnalysis.replace(target, replace);

// 2. DOE Mean Plot YAxis
target = `<YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} width={30} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: 0, fontSize: 10 }} />`;
replace = `<YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} width={65} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }} />`;
projectAnalysis = projectAnalysis.replace(target, replace);

// 2b. DOE Mean Plot Margin
target = `<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 35, bottom: 20 }}>`;
replace = `<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 65, bottom: 20 }}>`;
projectAnalysis = projectAnalysis.replace(target, replace);

// 3. Interaction Plot XAxis
target = `<XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -10, fontSize: 10 }} />`;
replace = `<XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} height={40} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: 0, fontSize: 10 }} />`;
projectAnalysis = projectAnalysis.replace(target, replace);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', projectAnalysis);

// 4. ResidualsPlots.tsx
let residuals = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

// Actual by Predicted Plot
target = `<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={35} label={{ value: 'Actual', angle: -90, position: 'insideLeft', dx: 0, fontSize: 10 }} />`;
replace = `<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={65} label={{ value: 'Actual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }} />`;
residuals = residuals.replace(target, replace);

target = `<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>`;
replace = `<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 65 }}>`;
residuals = residuals.replace(target, replace);

// Studentized Residuals Plot
target = `<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={35} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', dx: 0, fontSize: 10 }} />`;
replace = `<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={65} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }} />`;
residuals = residuals.replace(target, replace);

target = `<ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>`;
replace = `<ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 65 }}>`;
residuals = residuals.replace(target, replace);

fs.writeFileSync('src/components/ResidualsPlots.tsx', residuals);
console.log('Fixed axes');
