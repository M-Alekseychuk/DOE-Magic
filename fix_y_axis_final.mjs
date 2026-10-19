import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const targetChart = `<ScatterChart margin={{ top: 10, right: 30, left: 60, bottom: 20 }}>`;
const replaceChart = `<ScatterChart margin={{ top: 10, right: 30, left: 45, bottom: 20 }}>`;
content = content.replace(targetChart, replaceChart);

const targetYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={55}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: -5, dx: -15, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
const replaceYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={30}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, dx: -15, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
content = content.replace(targetYAxis, replaceYAxis);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
