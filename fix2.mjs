import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// I will just rebuild the innerJS as a single string to avoid any issues.
// Let's replace the whole stats-container update logic.

let newStats = `
document.getElementById('stats-container').innerHTML = 
  '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
  '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">R²</div>' +
  '<div class="text-lg font-bold text-slate-800">' + data.rSquared.toFixed(4) + '</div></div>' +
  '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
  '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">Adj R²</div>' +
  '<div class="text-lg font-bold text-slate-800">' + data.adjRSquared.toFixed(4) + '</div></div>' +
  '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
  '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">RMSE</div>' +
  '<div class="text-lg font-bold text-slate-800">' + data.rmse.toFixed(4) + '</div></div>' +
  '<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">' +
  '<div class="text-xs text-slate-500 uppercase tracking-widest font-bold">Model p-value</div>' +
  '<div class="text-lg font-bold text-slate-800">' + (data.p < 0.0001 ? "<0.0001" : data.p.toFixed(4)) + '</div></div>';
`;

// we need to find the stats container block
let lines = content.split('\n');
let newLines = [];
let skip = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("document.getElementById('stats-container').innerHTML = ' ' +")) {
    skip = true;
    newLines.push(newStats);
  }
  if (skip && lines[i].includes("            `;")) {
    skip = false;
    continue;
  }
  if (!skip) {
    newLines.push(lines[i]);
  }
}

fs.writeFileSync('src/utils/htmlExport.ts', newLines.join('\n'));

