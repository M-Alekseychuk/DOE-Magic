import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1. Remove the absolute div for Half-Normal
content = content.replace(
`<div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">
                  Half-Normal % Probability
                </div>`,
""
);

// 2. Change margin back to left: 40 (or left: 45) to not shrink the graph too much.
content = content.replace(
`<ScatterChart margin={{ top: 10, right: 30, left: 55, bottom: 20 }}>`,
`<ScatterChart margin={{ top: 10, right: 30, left: 45, bottom: 20 }}>`
);

// 3. Add the label properly inside YAxis using dx
const targetYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={35}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
const replacementYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={35}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', dx: -25, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;

content = content.replace(targetYAxis, replacementYAxis);

// 4. Fix DOE Mean Plot label as well just in case.
const targetMeanYAxis = `<YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', fontSize: 10 }} />`;
const replaceMeanYAxis = `<YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: -15, fontSize: 10 }} />`;
content = content.replace(targetMeanYAxis, replaceMeanYAxis);

// Also increase left margin on DOE mean plot slightly so the label isn't clipped
const targetMeanChart = `<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>`;
const replaceMeanChart = `<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>`;
content = content.replace(targetMeanChart, replaceMeanChart);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
