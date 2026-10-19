import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// Fix 1: Predict function
const oldPredict = `        function predict(coded_arr, estimates) {
            let y = 0;
            estimates.forEach(est => {
                if (est.termObj && est.termObj.type === 'intercept') y += est.estimate;
                else if (est.termObj && est.termObj.type === 'main') y += est.estimate * coded_arr[est.termObj.idx];
                else if (est.termObj && est.termObj.type === 'interaction') y += est.estimate * coded_arr[est.termObj.i] * coded_arr[est.termObj.j];
            });
            return y;
        }`;

const newPredict = `        function predict(coded_arr, estimates) {
            let y = 0;
            estimates.forEach(est => {
                const term = est.term;
                if (term === 'Intercept') {
                    y += est.estimate;
                } else if (term.includes('*')) {
                    const parts = term.split('*');
                    const idx1 = project.factors.findIndex(f => f.name === parts[0]);
                    const idx2 = project.factors.findIndex(f => f.name === parts[1]);
                    if (idx1 >= 0 && idx2 >= 0) y += est.estimate * coded_arr[idx1] * coded_arr[idx2];
                } else {
                    const idx = project.factors.findIndex(f => f.name === term);
                    if (idx >= 0) y += est.estimate * coded_arr[idx];
                }
            });
            return y;
        }`;

content = content.replace(oldPredict, newPredict);

// Fix 2: Studentized Residuals Plot
const oldRes = `                // Studentized Residuals
                if (data.studentizedResiduals && data.studentizedResiduals.length > 0) {
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
                }`;

const newRes = `                // Studentized Residuals
                if (data.studentizedResiduals && data.studentizedResiduals.length > 0) {
                    const resid = data.studentizedResiduals;
                    const resX = resid.map(d => d.run);
                    const resY = resid.map(d => d.studentized);
                    const limit = resid[0]?.limit || 2.5;
                    const bonferroniLimit = resid[0]?.bonferroniLimit || limit + 1;
                    const maxAbsResid = Math.max(...resY.map(y => Math.abs(y || 0)));
                    const yMax = Math.max(bonferroniLimit + 0.5, maxAbsResid + 0.5, 4);

                    Plotly.newPlot('plot-residuals', [
                        { x: resX, y: resY, mode: 'markers', type: 'scatter', marker: { color: '#1e293b' } }
                    ], {
                        margin: { t: 20, l: 60, r: 20, b: 40 },
                        xaxis: { title: 'Run Number' },
                        yaxis: { title: 'Studentized Residual', range: [-yMax, yMax] },
                        shapes: [
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: 0, y1: 0, line: { color: '#3b82f6' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: limit, y1: limit, line: { color: '#22c55e' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: -limit, y1: -limit, line: { color: '#22c55e' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: bonferroniLimit, y1: bonferroniLimit, line: { color: '#ef4444' } },
                            { type: 'line', x0: Math.min(...resX), x1: Math.max(...resX), y0: -bonferroniLimit, y1: -bonferroniLimit, line: { color: '#ef4444' } }
                        ]
                    });
                }`;

content = content.replace(oldRes, newRes);

fs.writeFileSync('src/utils/htmlExport.ts', content);
