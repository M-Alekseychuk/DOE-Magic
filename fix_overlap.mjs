import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1. Move the absolute label far left to `left-0`
const oldDiv = `<div className="absolute left-[-15px] top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">`;
const newDiv = `<div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">`;
content = content.replace(oldDiv, newDiv);

// 2. Increase the left margin of the chart so the axis and ticks are pushed further right
const oldChart = `<ScatterChart margin={{ top: 10, right: 30, left: 35, bottom: 20 }}>`;
const newChart = `<ScatterChart margin={{ top: 10, right: 30, left: 55, bottom: 20 }}>`;
content = content.replace(oldChart, newChart);

// 3. Since we pushed the left margin to 55, we can make the YAxis take up more space so it isn't squeezed.
const oldYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={30}`;
const newYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={35}`;
content = content.replace(oldYAxis, newYAxis);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed overlapping');
