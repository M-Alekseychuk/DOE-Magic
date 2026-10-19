import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Try a much larger margin, and increase the YAxis width
const targetChart = `<ScatterChart margin={{ top: 10, right: 30, left: 60, bottom: 20 }}>`;
const replaceChart = `<ScatterChart margin={{ top: 10, right: 30, left: 80, bottom: 20 }}>`;

content = content.replace(targetChart, replaceChart);

// Increase the width of the YAxis container and adjust label offset
const targetYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}
                      tickFormatter={(val) => {
                          if (Math.abs(val - 0) < 0.05) return '0';
                          if (Math.abs(val - 0.253) < 0.05) return '20';
                          if (Math.abs(val - 0.385) < 0.05) return '30';
                          if (Math.abs(val - 0.674) < 0.05) return '50';
                          if (Math.abs(val - 1.036) < 0.05) return '70';
                          if (Math.abs(val - 1.282) < 0.05) return '80';
                          if (Math.abs(val - 1.645) < 0.05) return '90';
                          if (Math.abs(val - 1.96) < 0.05) return '95';
                          if (Math.abs(val - 2.576) < 0.05) return '99';
                          return '';
                      }}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: -10, fontSize: 11, fill: '#334155' }} 
                    />`;
                    
const replaceYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={60}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}
                      tickFormatter={(val) => {
                          if (Math.abs(val - 0) < 0.05) return '0';
                          if (Math.abs(val - 0.253) < 0.05) return '20';
                          if (Math.abs(val - 0.385) < 0.05) return '30';
                          if (Math.abs(val - 0.674) < 0.05) return '50';
                          if (Math.abs(val - 1.036) < 0.05) return '70';
                          if (Math.abs(val - 1.282) < 0.05) return '80';
                          if (Math.abs(val - 1.645) < 0.05) return '90';
                          if (Math.abs(val - 1.96) < 0.05) return '95';
                          if (Math.abs(val - 2.576) < 0.05) return '99';
                          return '';
                      }}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: -45, fontSize: 11, fill: '#334155' }} 
                    />`;

content = content.replace(targetYAxis, replaceYAxis);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed Y-axis offset and width');
