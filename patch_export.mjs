import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// 1. Add fields to analysisData map
content = content.replace(
  "rmse: res.rmse,",
  "rmse: res.rmse,\n        effects: res.effects,\n        paretoData: res.paretoData,\n        halfNormalData: res.halfNormalData,\n        halfNormalLine: res.halfNormalLine,\n        tLimitPareto: res.tLimitPareto,\n        bonferroniLimitPareto: res.bonferroniLimitPareto,"
);

// 2. Remove Optimal Conditions from HTML layout
content = content.replace(
  `<div id="opt-container" class="bg-blue-50 border border-blue-100 p-4 rounded mb-6 text-sm"></div>`,
  ``
);

// 3. Add Main Effects Plot container
content = content.replace(
  `<div class="grid-2 mb-6">\n                <div class="border border-slate-200 rounded p-4">\n                    <h3>Effect Summary</h3>`,
  `<div class="border border-slate-200 rounded p-4 mb-6">\n                <h3>Main Effects Plot (Data Means)</h3>\n                <div id="main-effects-container" style="display: flex; gap: 16px; flex-wrap: wrap;"></div>\n            </div>\n\n            <div class="grid-2 mb-6">\n                <div class="border border-slate-200 rounded p-4">\n                    <h3>Effects Plot</h3>\n                    <div style="display: flex; gap: 16px; flex-wrap: wrap;">\n                        <div id="plot-pareto" style="flex: 1; min-width: 300px; height: 350px;"></div>\n                        <div id="plot-half-normal" style="flex: 1; min-width: 300px; height: 350px;"></div>\n                    </div>\n                </div>\n            </div>\n\n            <div class="grid-2 mb-6">\n                <div class="border border-slate-200 rounded p-4">\n                    <h3>Effect Summary</h3>`
);

// 4. Remove Optimal Conditions JS logic
const optCondRegex = /\/\/ Optimal Conditions[\s\S]*?document\.getElementById\('opt-container'\)\.innerHTML = optHtml;/m;
content = content.replace(optCondRegex, '');

// 5. Add JS logic for plotting Main Effects, Pareto, and Half-Normal
const extraJS = `
                // Main Effects Plot
                let mainEffHtml = '';
                const mainPlots = [];
                if (data.effects && data.effects.length > 0) {
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
                });

                // Pareto Plot
                if (data.paretoData && data.paretoData.length > 0) {
                    const sortedPareto = [...data.paretoData].sort((a,b) => a.tRatio - b.tRatio);
                    const yNames = sortedPareto.map(d => d.factor ? d.factor.name : d.term || d.name);
                    const xValues = sortedPareto.map(d => d.tRatio);
                    const colors = sortedPareto.map(d => {
                        const isSig = d.tRatio > data.tLimitPareto;
                        return isSig ? (d.direction === 'Positive' ? '#2563eb' : '#dc2626') : (d.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                    });
                    
                    const paretoTrace = {
                        x: xValues,
                        y: yNames,
                        type: 'bar',
                        orientation: 'h',
                        marker: { color: colors }
                    };

                    const paretoLayout = {
                        title: { text: 'Pareto (Standardized)', font: {size: 12} },
                        margin: { t: 30, l: 120, r: 20, b: 40 },
                        xaxis: { title: 't-Ratio' },
                        shapes: [
                            { type: 'line', x0: data.tLimitPareto, x1: data.tLimitPareto, y0: -0.5, y1: yNames.length - 0.5, line: { color: '#16a34a', dash: 'dash', width: 2 } },
                            { type: 'line', x0: data.bonferroniLimitPareto, x1: data.bonferroniLimitPareto, y0: -0.5, y1: yNames.length - 0.5, line: { color: '#9333ea', dash: 'dash', width: 2 } }
                        ]
                    };
                    Plotly.newPlot('plot-pareto', [paretoTrace], paretoLayout, {displayModeBar: false});
                }

                // Half-Normal Plot
                if (data.halfNormalData && data.halfNormalData.length > 0) {
                    const hnX = data.halfNormalData.map(d => d.expected);
                    const hnY = data.halfNormalData.map(d => d.tRatio);
                    const hnColors = data.halfNormalData.map(d => {
                        return d.significant ? (d.direction === 'Positive' ? '#2563eb' : '#dc2626') : (d.direction === 'Positive' ? '#bae6fd' : '#fecaca');
                    });
                    const hnTexts = data.halfNormalData.map(d => d.term || d.name);

                    const hnScatter = {
                        x: hnX,
                        y: hnY,
                        mode: 'markers',
                        type: 'scatter',
                        text: hnTexts,
                        marker: { color: hnColors, size: 8, symbol: 'square', line: {color: '#000', width: 0.5} }
                    };
                    
                    const hnLayout = {
                        title: { text: 'Half-Normal', font: {size: 12} },
                        margin: { t: 30, l: 40, r: 20, b: 40 },
                        xaxis: { title: 'Half-Normal Quantile' },
                        yaxis: { title: 'Absolute Effect' }
                    };

                    if (data.halfNormalLine && data.halfNormalLine.length >= 2) {
                        hnLayout.shapes = [{
                            type: 'line',
                            x0: data.halfNormalLine[0].x,
                            y0: data.halfNormalLine[0].y,
                            x1: data.halfNormalLine[1].x,
                            y1: data.halfNormalLine[1].y,
                            line: { color: '#f87171', width: 2 }
                        }];
                    }

                    Plotly.newPlot('plot-half-normal', [hnScatter], hnLayout, {displayModeBar: false});
                }
`;

// Insert the new JS logic before "1. Effect Summary"
const sumRegex = /\/\/ 1\. Effect Summary/;
content = content.replace(sumRegex, extraJS + "\n                // 1. Effect Summary");

fs.writeFileSync('src/utils/htmlExport.ts', content);
