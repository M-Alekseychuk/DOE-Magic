import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1) Fix Y-axis label being cut off by using a div instead of a label prop in Recharts
// Remove the label prop entirely from the YAxis
const targetYAxis = `<YAxis 
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
                    
const replaceYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={30}
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
                    />`;
content = content.replace(targetYAxis, replaceYAxis);

// Add absolute positioned div for the Y-axis label
const targetContainer = `<ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 80, bottom: 20 }}>`;

const replaceContainer = `<div className="absolute left-[-5px] top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">
                  Half-Normal % Probability
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 35, bottom: 20 }}>`;
content = content.replace(targetContainer, replaceContainer);

// Make parent relative
const targetParent = `<div className="h-64 w-full">`;
const replaceParent = `<div className="h-64 w-full relative">`;
content = content.replace(targetParent, replaceParent);


// 2) Actual by Predicted Plot Decimals
const actTarget = `<ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="actual" name="Actual" tick={{fontSize: 10}} domain={['auto', 'auto']} label={{ value: 'Actual', position: 'insideBottom', offset: -15, fontSize: 11 }} />
                  <YAxis type="number" dataKey="predicted" name="Predicted" tick={{fontSize: 10}} domain={['auto', 'auto']} label={{ value: 'Predicted', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{fontSize: '11px', borderRadius: '4px'}} />`;
                  
const actReplace = `<ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="actual" name="Actual" tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} domain={['auto', 'auto']} label={{ value: 'Actual', position: 'insideBottom', offset: -15, fontSize: 11 }} />
                  <YAxis type="number" dataKey="predicted" name="Predicted" tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} domain={['auto', 'auto']} label={{ value: 'Predicted', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{fontSize: '11px', borderRadius: '4px'}} formatter={(val) => Number(val).toFixed(2)} />`;
content = content.replace(actTarget, actReplace);

// 3) Studentized Residuals Plot Decimals
const resTarget = `<ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="run" name="Run Order" tick={{fontSize: 10}} domain={[0, 'dataMax + 1']} label={{ value: 'Run Order', position: 'insideBottom', offset: -15, fontSize: 11 }} />
                  <YAxis type="number" dataKey="studentized" name="Studentized Residual" tick={{fontSize: 10}} domain={[-resMax, resMax]} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{fontSize: '11px', borderRadius: '4px'}} />`;
                  
const resReplace = `<ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="run" name="Run Order" tick={{fontSize: 10}} domain={[0, 'dataMax + 1']} label={{ value: 'Run Order', position: 'insideBottom', offset: -15, fontSize: 11 }} />
                  <YAxis type="number" dataKey="studentized" name="Studentized Residual" tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} domain={[-resMax, resMax]} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{fontSize: '11px', borderRadius: '4px'}} formatter={(val) => Number(val).toFixed(2)} />`;
content = content.replace(resTarget, resReplace);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed everything');
