import fs from 'fs';

// Patch ProjectAnalysis.tsx
let pa = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const paOldAverages = `const allAverages = analysisResults?.effects.flatMap(e => [e.lowAvg, e.highAvg]) || [];`;
const paNewAverages = `const allAverages = analysisResults?.effects.flatMap(e => [e.lowAvg, e.centerAvg, e.highAvg].filter(v => v !== null)) || [];`;
pa = pa.replace(paOldAverages, paNewAverages);

const paOldData = `                        <LineChart data={[
                          { x: effect.factor.min, value: effect.lowAvg },
                          { x: effect.factor.max, value: effect.highAvg }
                        ]} margin={{ top: 5, right: 10, left: 5, bottom: 20 }}>`;
const paNewData = `                        <LineChart data={[
                          { x: effect.factor.min, value: effect.lowAvg },
                          ...(effect.centerAvg !== null ? [{ x: midX, value: effect.centerAvg }] : []),
                          { x: effect.factor.max, value: effect.highAvg }
                        ]} margin={{ top: 5, right: 10, left: 5, bottom: 20 }}>`;
pa = pa.replace(paOldData, paNewData);

const paOldLine = `<Line type="linear" dataKey="value" stroke="#3ab9a0" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />`;
const paNewLine = `<Line type="linear" dataKey="value" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 4.5, fill: "#60a5fa" }} activeDot={{ r: 6 }} />`;
pa = pa.replace(paOldLine, paNewLine);
pa = pa.replace('<ReferenceLine x={midX} stroke="#cbd5e1" strokeDasharray="3 3" />', '<ReferenceLine x={midX} stroke="#94a3b8" />');

fs.writeFileSync('src/components/ProjectAnalysis.tsx', pa);

// Patch htmlExport.ts Main Effects Plot
let he = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

const heOldJsMain = `                if (data.effects && data.effects.length > 0) {
                    const allAverages = [];
                    data.effects.forEach(e => { allAverages.push(e.lowAvg, e.highAvg); });
                    const minAvg = Math.min(...allAverages);
                    const maxAvg = Math.max(...allAverages);
                    const range = maxAvg - minAvg;
                    const padding = range === 0 ? 1 : range * 0.1;
                    const yDomain = [minAvg - padding, maxAvg + padding];

                    data.effects.forEach((effect, i) => {
                        const plotId = 'plot-main-effect-' + i;
                        mainEffHtml += '<div style="flex: 1; min-width: 200px; height: 250px; border: 1px solid #f1f5f9; padding: 4px;"><div id="' + plotId + '" style="height: 100%;"></div></div>';
                        mainPlots.push({ id: plotId, effect, yDomain });
                    });
                } else {
                    mainEffHtml = '<p style="color: #64748b; margin-top: 8px;">No main effects data available.</p>';
                }
                document.getElementById('main-effects-container').innerHTML = mainEffHtml;

                // Render Main Effects Plots
                mainPlots.forEach(p => {
                    const trace = {
                        x: [p.effect.factor.min, p.effect.factor.max],
                        y: [p.effect.lowAvg, p.effect.highAvg],
                        mode: 'lines+markers',
                        type: 'scatter',
                        name: p.effect.factor.name,
                        line: { color: '#0ea5e9', width: 3 },
                        marker: { size: 8 }
                    };
                    Plotly.newPlot(p.id, [trace], {
                        title: { text: p.effect.factor.name, font: { size: 12 } },
                        margin: { t: 30, l: 40, r: 10, b: 30 },
                        xaxis: { tickvals: [p.effect.factor.min, p.effect.factor.max], ticktext: [p.effect.factor.min, p.effect.factor.max] },
                        yaxis: { range: p.yDomain },
                        showlegend: false
                    }, {displayModeBar: false});
                });`;

const heNewJsMain = `                if (data.effects && data.effects.length > 0) {
                    const allAverages = [];
                    data.effects.forEach(e => { 
                        if (e.lowAvg !== null) allAverages.push(e.lowAvg);
                        if (e.centerAvg !== null) allAverages.push(e.centerAvg);
                        if (e.highAvg !== null) allAverages.push(e.highAvg);
                    });
                    const minAvg = Math.min(...allAverages);
                    const maxAvg = Math.max(...allAverages);
                    const range = maxAvg - minAvg;
                    const padding = range === 0 ? 1 : range * 0.1;
                    const yDomain = [minAvg - padding, maxAvg + padding];

                    data.effects.forEach((effect, i) => {
                        const plotId = 'plot-main-effect-' + i;
                        mainEffHtml += '<div style="flex: 1; min-width: 200px; height: 250px; border: 1px solid #f1f5f9; padding: 4px;"><div id="' + plotId + '" style="height: 100%;"></div></div>';
                        mainPlots.push({ id: plotId, effect, yDomain });
                    });
                } else {
                    mainEffHtml = '<p style="color: #64748b; margin-top: 8px;">No main effects data available.</p>';
                }
                document.getElementById('main-effects-container').innerHTML = mainEffHtml;

                // Render Main Effects Plots
                mainPlots.forEach(p => {
                    const midX = (p.effect.factor.min + p.effect.factor.max) / 2;
                    let xs = [p.effect.factor.min];
                    let ys = [p.effect.lowAvg];
                    if (p.effect.centerAvg !== null) {
                        xs.push(midX);
                        ys.push(p.effect.centerAvg);
                    }
                    xs.push(p.effect.factor.max);
                    ys.push(p.effect.highAvg);
                    
                    const trace = {
                        x: xs,
                        y: ys,
                        mode: 'lines+markers',
                        type: 'scatter',
                        name: p.effect.factor.name,
                        line: { color: '#60a5fa', width: 2.5 },
                        marker: { size: 9, color: '#60a5fa' }
                    };
                    Plotly.newPlot(p.id, [trace], {
                        title: { text: p.effect.factor.name, font: { size: 12 } },
                        margin: { t: 30, l: 40, r: 10, b: 30 },
                        xaxis: { tickvals: [p.effect.factor.min, midX, p.effect.factor.max], ticktext: [p.effect.factor.min, midX, p.effect.factor.max] },
                        yaxis: { range: p.yDomain },
                        showlegend: false,
                        shapes: [{ type: 'line', x0: midX, x1: midX, y0: p.yDomain[0], y1: p.yDomain[1], line: { color: '#94a3b8' } }]
                    }, {displayModeBar: false});
                });`;

he = he.replace(heOldJsMain, heNewJsMain);
fs.writeFileSync('src/utils/htmlExport.ts', he);
