import fs from 'fs';

const code = `import { Project } from '../types';
import { computeAnalysis } from './analysisCore';

export function generateExportHTML(project: Project): string {
  const analysisData: Record<string, any> = {};
  for (const resp of project.responses) {
    const res = computeAnalysis(project, resp, resp.excludedTerms || [], resp.goal, resp.targetValue);
    if (res) {
      analysisData[resp.id] = {
        actualByPredicted: res.actualByPredicted,
        studentizedResiduals: res.studentizedResiduals,
        parameterEstimates: res.parameterEstimates,
        optimalConditions: res.optimalConditions,
        rSquared: res.rSquared,
        adjRSquared: res.adjRSquared,
        rmse: res.rmse,
        p: res.p
      };
    }
  }

  const designTypeNames: Record<string, string> = {
    'factorial_2level': 'Two-Level Factorial Design',
    'dsd': 'Definitive Screening Design (DSD)',
    'ccd': 'Central Composite Design (CCD)',
    'bbd': 'Box-Behnken Design (BBD)',
    'plackett_burman': 'Plackett-Burman Design (PB)'
  };
  const designName = designTypeNames[project.designType || 'factorial_2level'] || 'Not specified';

  const html = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Experiment Export: \${project.name}</title>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', system-ui, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
        h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        h2 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        h3 { font-size: 0.75rem; font-weight: 700; color: #0c75b3; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.875rem; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background: #f8fafc; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
        select { border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 0.875rem; background: white; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="max-w-7xl mx-auto">
        <div class="card">
            <h1>Experiment: \${project.name}</h1>
            <p class="text-slate-600 mb-4">\${project.description || 'DOE Magic Export'}</p>
            <p class="text-sm"><strong>Design Used:</strong> \${designName}</p>
        </div>

        <div class="grid-2">
            <div class="card">
                <h2>Factors</h2>
                <table>
                    <thead><tr><th>Name</th><th>Type</th><th>Min</th><th>Max</th><th>Unit</th></tr></thead>
                    <tbody>
                        \${project.factors.map(f => \`<tr><td>\${f.name}</td><td>\${f.type}</td><td>\${f.min}</td><td>\${f.max}</td><td>\${f.unit || '-'}</td></tr>\`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card">
                <h2>Responses</h2>
                <table>
                    <thead><tr><th>Name</th><th>Goal</th><th>Target</th><th>Unit</th></tr></thead>
                    <tbody>
                        \${project.responses.map(r => \`<tr><td>\${r.name}</td><td>\${r.goal}</td><td>\${r.targetValue ?? '-'}</td><td>\${r.unit || '-'}</td></tr>\`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <h2>Analysis & Optimization</h2>
            <div class="mb-6 flex items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label class="font-semibold text-sm">Select Response to View:</label>
                <select id="response-select" onchange="updateView()">
                    \${project.responses.map(r => \`<option value="\${r.id}">\${r.name}</option>\`).join('')}
                </select>
            </div>

            <div id="stats-container" class="grid grid-cols-4 gap-4 mb-6">
                <!-- Stats injected here -->
            </div>

            <div id="opt-container" class="bg-blue-50 border border-blue-100 p-4 rounded mb-6 text-sm">
                <!-- Optimization injected here -->
            </div>

            <div class="grid-2 mb-6">
                <div class="border border-slate-200 rounded p-2">
                    <h3>Actual by Predicted</h3>
                    <div id="plot-actual-pred" style="height: 300px;"></div>
                </div>
                <div class="border border-slate-200 rounded p-2">
                    <h3>Studentized Residuals</h3>
                    <div id="plot-residuals" style="height: 300px;"></div>
                </div>
            </div>

            <div class="border border-slate-200 rounded p-4 mb-6">
                <div class="flex justify-between items-center mb-2">
                    <h3>Interaction Plot</h3>
                    <div class="flex gap-4">
                        <label class="text-xs">Factor 1 (X-Axis): 
                            <select id="int-f1" onchange="updateInteractionPlot()"></select>
                        </label>
                        <label class="text-xs">Factor 2 (Legend): 
                            <select id="int-f2" onchange="updateInteractionPlot()"></select>
                        </label>
                    </div>
                </div>
                <div id="plot-interaction" style="height: 400px;"></div>
            </div>

            <div class="border border-slate-200 rounded p-4">
                <div class="flex justify-between items-center mb-2">
                    <h3>Contour & Response Surface Plot</h3>
                    <div class="flex gap-4 items-center">
                        <label class="text-xs">Type: 
                            <select id="surf-type" onchange="updateSurfacePlot()">
                                <option value="mesh3d">Surface 3D (Mesh)</option>
                                <option value="contour">Contour 2D</option>
                            </select>
                        </label>
                        <label class="text-xs">X-Axis: 
                            <select id="surf-x" onchange="updateSurfacePlot()"></select>
                        </label>
                        <label class="text-xs">Y-Axis: 
                            <select id="surf-y" onchange="updateSurfacePlot()"></select>
                        </label>
                    </div>
                </div>
                <div id="plot-surface" style="height: 500px;"></div>
            </div>
        </div>

        <div class="card overflow-x-auto">
            <h2>Design Matrix & Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Run</th>
                        \${project.factors.map(f => \`<th>\${f.name}</th>\`).join('')}
                        \${project.responses.map(r => \`<th>\${r.name}</th>\`).join('')}
                    </tr>
                </thead>
                <tbody>
                    \${project.runs.map((r, i) => \`
                        <tr>
                            <td>\${i + 1}</td>
                            \${project.factors.map(f => \`<td>\${r.factors[f.id]}</td>\`).join('')}
                            \${project.responses.map(res => \`<td>\${r.responses[res.id] !== null ? r.responses[res.id] : '-'}</td>\`).join('')}
                        </tr>
                    \`).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const project = \${JSON.stringify(project)};
        const analysisData = \${JSON.stringify(analysisData)};

        function predict(coded_arr, estimates) {
            let y = 0;
            estimates.forEach(est => {
                if (est.termObj.type === 'intercept') y += est.estimate;
                else if (est.termObj.type === 'main') y += est.estimate * coded_arr[est.termObj.idx];
                else if (est.termObj.type === 'interaction') y += est.estimate * coded_arr[est.termObj.i] * coded_arr[est.termObj.j];
            });
            return y;
        }

        function populateSelects() {
            const intF1 = document.getElementById('int-f1');
            const intF2 = document.getElementById('int-f2');
            const surfX = document.getElementById('surf-x');
            const surfY = document.getElementById('surf-y');
            
            let options = '';
            project.factors.forEach((f, i) => {
                options += \`<option value="\${i}">\${f.name}</option>\`;
            });
            
            intF1.innerHTML = options;
            intF2.innerHTML = options;
            surfX.innerHTML = options;
            surfY.innerHTML = options;
            
            if (project.factors.length > 1) {
                intF2.selectedIndex = 1;
                surfY.selectedIndex = 1;
            }
        }

        function updateView() {
            const respId = document.getElementById('response-select').value;
            const data = analysisData[respId];
            if (!data) return;

            // Stats
            document.getElementById('stats-container').innerHTML = \`
                <div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">
                    <div class="text-xs text-slate-500 uppercase tracking-widest font-bold">R²</div>
                    <div class="text-lg font-bold text-slate-800">\${data.rSquared.toFixed(4)}</div>
                </div>
                <div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">
                    <div class="text-xs text-slate-500 uppercase tracking-widest font-bold">Adj R²</div>
                    <div class="text-lg font-bold text-slate-800">\${data.adjRSquared.toFixed(4)}</div>
                </div>
                <div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">
                    <div class="text-xs text-slate-500 uppercase tracking-widest font-bold">RMSE</div>
                    <div class="text-lg font-bold text-slate-800">\${data.rmse.toFixed(4)}</div>
                </div>
                <div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">
                    <div class="text-xs text-slate-500 uppercase tracking-widest font-bold">Model p-value</div>
                    <div class="text-lg font-bold text-slate-800">\${data.p < 0.0001 ? '<0.0001' : data.p.toFixed(4)}</div>
                </div>
            \`;

            // Optimal Conditions
            let optHtml = '<strong>Optimal Conditions:</strong><br/>';
            if (data.optimalConditions && data.optimalConditions.factors) {
                data.optimalConditions.factors.forEach(f => {
                    optHtml += \`\${f.factor.name}: <strong>\${f.optimalValue}</strong> \${f.factor.unit || ''} (Coded: \${f.codedValue.toFixed(2)})<br/>\`;
                });
                optHtml += \`<br/>Predicted Response: <strong>\${data.optimalConditions.expectedY.toFixed(4)}</strong> (Desirability: \${data.optimalConditions.desirability.toFixed(4)})\`;
            } else {
                optHtml += 'Not calculated.';
            }
            document.getElementById('opt-container').innerHTML = optHtml;

            // Actual by Predicted Plot
            const actPred = data.actualByPredicted;
            const actual = actPred.map(d => d.actual);
            const pred = actPred.map(d => d.predicted);
            const minVal = Math.min(...actual, ...pred);
            const maxVal = Math.max(...actual, ...pred);
            
            Plotly.newPlot('plot-actual-pred', [
                { x: pred, y: actual, mode: 'markers', type: 'scatter', name: 'Data', marker: { color: '#0ea5e9' } },
                { x: [minVal, maxVal], y: [minVal, maxVal], mode: 'lines', type: 'scatter', name: 'Perfect Fit', line: { color: '#ef4444', dash: 'dash' } }
            ], { margin: { t: 20, l: 40, r: 20, b: 40 }, xaxis: { title: 'Predicted' }, yaxis: { title: 'Actual' }, showlegend: false });

            // Studentized Residuals
            const resid = data.studentizedResiduals;
            const resX = resid.map(d => d.predicted);
            const resY = resid.map(d => d.residual);
            Plotly.newPlot('plot-residuals', [
                { x: resX, y: resY, mode: 'markers', type: 'scatter', marker: { color: '#8b5cf6' } }
            ], {
                margin: { t: 20, l: 40, r: 20, b: 40 },
                xaxis: { title: 'Predicted' },
                yaxis: { title: 'Studentized Residual' },
                shapes: [
                    { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: 0, y1: 0, line: { color: '#94a3b8', dash: 'dash' } },
                    { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: 3, y1: 3, line: { color: '#ef4444', dash: 'dot' } },
                    { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: -3, y1: -3, line: { color: '#ef4444', dash: 'dot' } }
                ]
            });

            updateInteractionPlot();
            updateSurfacePlot();
        }

        function updateInteractionPlot() {
            const respId = document.getElementById('response-select').value;
            const data = analysisData[respId];
            if (!data) return;

            const f1Idx = parseInt(document.getElementById('int-f1').value);
            const f2Idx = parseInt(document.getElementById('int-f2').value);
            const f1 = project.factors[f1Idx];
            const f2 = project.factors[f2Idx];

            let coded_low = new Array(project.factors.length).fill(0);
            coded_low[f2Idx] = -1;
            coded_low[f1Idx] = -1;
            const y_low_low = predict(coded_low, data.parameterEstimates);
            coded_low[f1Idx] = 1;
            const y_high_low = predict(coded_low, data.parameterEstimates);

            let coded_high = new Array(project.factors.length).fill(0);
            coded_high[f2Idx] = 1;
            coded_high[f1Idx] = -1;
            const y_low_high = predict(coded_high, data.parameterEstimates);
            coded_high[f1Idx] = 1;
            const y_high_high = predict(coded_high, data.parameterEstimates);

            Plotly.newPlot('plot-interaction', [
                { x: [-1, 1], y: [y_low_low, y_high_low], mode: 'lines+markers', name: \`\${f2.name} = Low (\${f2.min})\`, line: { color: '#3b82f6' } },
                { x: [-1, 1], y: [y_low_high, y_high_high], mode: 'lines+markers', name: \`\${f2.name} = High (\${f2.max})\`, line: { color: '#ef4444' } }
            ], {
                margin: { t: 20, l: 40, r: 20, b: 40 },
                xaxis: { title: f1.name, tickvals: [-1, 1], ticktext: ['Low (-1)', 'High (+1)'] },
                yaxis: { title: 'Predicted Response' },
                legend: { orientation: 'h', y: -0.2 }
            });
        }

        function updateSurfacePlot() {
            const respId = document.getElementById('response-select').value;
            const data = analysisData[respId];
            if (!data) return;

            const type = document.getElementById('surf-type').value;
            const f1Idx = parseInt(document.getElementById('surf-x').value);
            const f2Idx = parseInt(document.getElementById('surf-y').value);
            const f1 = project.factors[f1Idx];
            const f2 = project.factors[f2Idx];

            const gridSteps = 30;
            const x = [];
            const y = [];
            const z = [];

            for (let i = 0; i <= gridSteps; i++) {
                x.push(-1 + (2 * i) / gridSteps);
                y.push(-1 + (2 * i) / gridSteps);
            }

            for (let j = 0; j <= gridSteps; j++) {
                const row = [];
                for (let i = 0; i <= gridSteps; i++) {
                    const coded = new Array(project.factors.length).fill(0);
                    coded[f1Idx] = x[i];
                    coded[f2Idx] = y[j];
                    row.push(predict(coded, data.parameterEstimates));
                }
                z.push(row);
            }

            if (type === 'mesh3d') {
                Plotly.newPlot('plot-surface', [{
                    x: x.map(cx => f1.min + ((cx + 1) / 2) * (f1.max - f1.min)),
                    y: y.map(cy => f2.min + ((cy + 1) / 2) * (f2.max - f2.min)),
                    z: z,
                    type: 'surface',
                    colorscale: 'Viridis',
                    contours: { z: { show: true, usecolormap: false, project: { z: true } } }
                }], {
                    margin: { t: 20, l: 0, r: 0, b: 0 },
                    scene: {
                        xaxis: { title: f1.name },
                        yaxis: { title: f2.name },
                        zaxis: { title: 'Response' }
                    }
                });
            } else {
                Plotly.newPlot('plot-surface', [{
                    x: x.map(cx => f1.min + ((cx + 1) / 2) * (f1.max - f1.min)),
                    y: y.map(cy => f2.min + ((cy + 1) / 2) * (f2.max - f2.min)),
                    z: z,
                    type: 'contour',
                    colorscale: 'Viridis'
                }], {
                    margin: { t: 20, l: 40, r: 20, b: 40 },
                    xaxis: { title: f1.name },
                    yaxis: { title: f2.name }
                });
            }
        }

        // Initialize
        populateSelects();
        updateView();
    </script>
</body>
</html>\`;

  return html;
}
`
fs.writeFileSync('src/utils/htmlExport.ts', code);
