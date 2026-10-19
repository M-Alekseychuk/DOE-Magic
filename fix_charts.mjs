import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Fix Pareto Chart Bar dataKey
content = content.replace(`<Bar dataKey="absEffect" name="Absolute Effect" radius={[0, 4, 4, 0]}>`, `<Bar dataKey="tRatio" name="t-Ratio" radius={[0, 4, 4, 0]}>`);

// Update Half-Normal calculation to add slope
const targetHalfNormalCalc = `    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.tRatio > tLimitPareto };
    });`;

const replacementHalfNormalCalc = `    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.tRatio > tLimitPareto };
    });
    
    // Fit a line to the smallest 50% of effects
    let halfNormalSlope = 1;
    const nSmallest = Math.max(1, Math.floor(halfNormalData.length * 0.5));
    let sumX2 = 0;
    let sumXY = 0;
    for (let i = 0; i < nSmallest; i++) {
        sumX2 += halfNormalData[i].tRatio * halfNormalData[i].tRatio;
        sumXY += halfNormalData[i].tRatio * halfNormalData[i].expected;
    }
    if (sumX2 > 0) {
        halfNormalSlope = sumXY / sumX2;
    }
    const maxT = halfNormalData.length > 0 ? Math.max(...halfNormalData.map(d => d.tRatio)) : 1;
    const halfNormalLine = [
        { x: 0, y: 0 },
        { x: maxT, y: halfNormalSlope * maxT }
    ];`;

content = content.replace(targetHalfNormalCalc, replacementHalfNormalCalc);

// Expose halfNormalLine
content = content.replace(`halfNormalData, \n      bestPred,`, `halfNormalData, \n      halfNormalLine,\n      bestPred,`);

// Fix Half-Normal Chart
const targetHalfNormalChart = `                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="absEffect" name="Absolute Effect" tick={{fontSize: 10}} label={{ value: '|Effect|', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="number" dataKey="expected" name="Half-Normal Quantile" tick={{fontSize: 10}} label={{ value: 'Half-Normal Quantile', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                    <ZAxis type="category" dataKey="factor.name" name="Factor" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{fontSize: '11px', borderRadius: '4px'}}
                      formatter={(value: number, name: string, props: any) => [
                        name === 'Factor' || name === 'factor.name' ? props.payload.name : value.toFixed(3),
                        name === 'Factor' || name === 'factor.name' ? 'Factor' : (props.payload.direction ? \`\${props.payload.direction} Effect\` : 'Value')
                      ]}
                      labelFormatter={(label, payload) => {
                         if (payload && payload.length > 0) {
                            return payload[0].payload.name;
                         }
                         return '';
                      }}
                    />
                    <Scatter data={analysisResults.halfNormalData} shape="square">
                      {analysisResults.halfNormalData.map((entry, index) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.significant ? (entry.direction === 'Positive' ? '#3b82f6' : '#ef4444') : '#cbd5e1'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>`;

const replacementHalfNormalChart = `                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="tRatio" name="|Standardized Effect|" tick={{fontSize: 10}} label={{ value: '|Standardized Effect|', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#334155' }} />
                    
                    <YAxis 
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
                    />
                    
                    <ZAxis type="category" dataKey="factor.name" name="Factor" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{fontSize: '11px', borderRadius: '4px'}}
                      formatter={(value: number, name: string, props: any) => [
                        name === 'Factor' || name === 'factor.name' ? props.payload.name : value.toFixed(3),
                        name === 'Factor' || name === 'factor.name' ? 'Factor' : (props.payload.direction ? \`\${props.payload.direction} Effect\` : 'Value')
                      ]}
                      labelFormatter={(label, payload) => {
                         if (payload && payload.length > 0) {
                            return payload[0].payload.name;
                         }
                         return '';
                      }}
                    />
                    <Scatter data={analysisResults.halfNormalData} shape="square" stroke="#000" strokeWidth={0.5}>
                      {analysisResults.halfNormalData.map((entry: any, index: number) => (
                        <Cell key={\`cell-\${index}\`} fill={entry.direction === 'Positive' ? '#f97316' : '#3b82f6'} />
                      ))}
                    </Scatter>
                    <Line type="linear" dataKey="y" data={analysisResults.halfNormalLine} stroke="#f87171" strokeWidth={2} dot={false} activeDot={false} legendType="none" />
                  </ScatterChart>
                </ResponsiveContainer>`;

content = content.replace(targetHalfNormalChart, replacementHalfNormalChart);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed charts.');
