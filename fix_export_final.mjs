import fs from 'fs';

let he = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// 1. Re-order layout and add Pattern / Center points to Design Matrix
const designMatrixOld = /<div class="card overflow-x-auto">\s*<h2>Design Matrix & Results<\/h2>[\s\S]*?<\/div>/m;
const matchDM = he.match(designMatrixOld);
if (matchDM) {
  let dmHtml = matchDM[0];
  he = he.replace(designMatrixOld, ''); // remove it from bottom
  
  // Update dmHtml to include Pattern
  dmHtml = dmHtml.replace('<th>Run</th>', '<th>Run</th><th>Pattern</th>');
  
  const rowLoopStart = dmHtml.indexOf('project.runs.forEach((r, i) => {');
  if (rowLoopStart !== -1) {
    // we need to insert pattern logic
    const oldRowHead = 'html += `<tr><td>${i + 1}</td>`;';
    const newRowHead = `    const pattern = getRunPattern(r, project.factors);
    const isCenter = project.factors.every(f => {
      const val = Number(r.factors[f.id]);
      if (isNaN(val)) return false;
      const center = (f.min + f.max) / 2;
      return Math.abs(val - center) < 1e-6;
    });
    const centerIndicator = isCenter ? ' <span style="color:#64748b; font-size:10px;">(Center)</span>' : '';
    html += \`<tr><td>\${i + 1}</td><td>\${pattern}\${centerIndicator}</td>\`;`;
    dmHtml = dmHtml.replace(oldRowHead, newRowHead);
  }
  
  // Insert right after the Factors/Responses grid-2
  const grid2Responses = /<div class="grid-2">[\s\S]*?<\/div>\s*<\/div>\s*<div class="card">/m;
  he = he.replace(grid2Responses, match => {
    return match.replace('<div class="card">', dmHtml + '\n\n        <div class="card">');
  });
}

// 2. Fix Effect Summary logworth display
const effSumOld = /'<td><div style="width:100%;background:#f1f5f9;height:12px;position:relative;"><div style="position:absolute;top:0;left:0;height:100%;background:#0ea5e9;width:' \+ Math\.min\(100, ef\.logP \* 10\) \+ '%"><\/div><\/div><\/td>' \+/g;
const effSumNew = `'<td><div style="display:flex; align-items:center; gap:8px;"><span style="font-family:monospace; width:35px; text-align:right;">' + (ef.logworth > 0 ? ef.logworth.toFixed(3) : '') + '</span><div style="flex:1; background:#f1f5f9; height:12px; position:relative;"><div style="position:absolute;top:0;left:0;height:100%;background:#cbd5e1;width:' + Math.min(100, ef.logworth * 10) + '%"></div>' + (ef.logworth >= -Math.log10(0.05) ? '<div style="position:absolute;top:0;bottom:0;border-left:1px solid #3b82f6;left:13.01%;"></div>' : '') + '</div></div></td>' +`;
he = he.replace(effSumOld, effSumNew);
he = he.replace(/ef\.logP \* 10/g, 'ef.logworth * 10');

// 3. Fix Half-Normal Plot (X and Y swapped, add color/ticks)
const hnOld = `                    const hnScatter = {
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
                    }`;
                    
const hnNew = `                    const hnScatter = {
                        x: hnY, // tRatio (Absolute Effect)
                        y: hnX, // expected (Quantile / Probability)
                        mode: 'markers',
                        type: 'scatter',
                        text: hnTexts,
                        marker: { color: hnColors, size: 8, symbol: 'square', line: {color: '#000', width: 0.5} }
                    };
                    
                    const hnLayout = {
                        title: { text: 'Half-Normal', font: {size: 12} },
                        margin: { t: 30, l: 40, r: 20, b: 40 },
                        xaxis: { title: '|Standardized Effect|' },
                        yaxis: { 
                            title: 'Half-Normal % Probability',
                            tickvals: [0, 0.253, 0.385, 0.674, 1.036, 1.282, 1.645, 1.96, 2.576],
                            ticktext: ['0', '20', '30', '50', '70', '80', '90', '95', '99'],
                            range: [-0.1, 2.7]
                        }
                    };

                    if (data.halfNormalLine && data.halfNormalLine.length >= 2) {
                        hnLayout.shapes = [{
                            type: 'line',
                            x0: data.halfNormalLine[0].y,
                            y0: data.halfNormalLine[0].x,
                            x1: data.halfNormalLine[1].y,
                            y1: data.halfNormalLine[1].x,
                            line: { color: '#f87171', width: 2 }
                        }];
                    }`;
he = he.replace(hnOld, hnNew);

fs.writeFileSync('src/utils/htmlExport.ts', he);
