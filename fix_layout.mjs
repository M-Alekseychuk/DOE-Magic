import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// 1. Move Prediction Profiler
// Find Prediction Profiler bounds
const profilerStart = content.indexOf('{/* Prediction Profiler */}');
const diagnosticStart = content.indexOf('{/* Diagnostic Plots */}');

if (profilerStart !== -1 && diagnosticStart !== -1) {
    const profilerBlock = content.substring(profilerStart, diagnosticStart);
    
    // Remove profilerBlock from original location
    content = content.replace(profilerBlock, '');
    
    // Find Predictive Model & Optimal Conditions
    const predictiveStart = content.indexOf('{/* Predictive Model & Optimal Conditions */}');
    
    if (predictiveStart !== -1) {
        // Insert before Predictive Model
        content = content.slice(0, predictiveStart) + profilerBlock + '\n        ' + content.slice(predictiveStart);
    }
}

// 2. Fix Half-Normal YAxis and margins
const targetChart = `<ScatterChart margin={{ top: 10, right: 30, left: 45, bottom: 20 }}>`;
const replaceChart = `<ScatterChart margin={{ top: 10, right: 30, left: 60, bottom: 20 }}>`;
content = content.replace(targetChart, replaceChart);

const targetYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={35}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', dx: -25, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
const replaceYAxis = `<YAxis 
                      type="number" 
                      dataKey="expected" 
                      name="Half-Normal % Probability" 
                      width={55}
                      tick={{fontSize: 10}} 
                      domain={[-0.1, 2.7]}
                      label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: -5, dx: -15, fontSize: 11, fill: '#334155' }}
                      ticks={[0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576]}`;
                      
content = content.replace(targetYAxis, replaceYAxis);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
