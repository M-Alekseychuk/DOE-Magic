import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// 1. Add import for getRunPattern
if (!content.includes("import { getRunPattern }")) {
  content = content.replace("import { computeAnalysis }", "import { computeAnalysis } from './analysisCore';\nimport { getRunPattern } from './doePatterns';");
}
if (!content.includes("import { logoBase64 }")) {
  content = content.replace("import { Project }", "import { Project } from '../types';\nimport { logoBase64 } from './logoBase64';");
}

// 2. Add Logo and re-order
const oldCard = `        <div class="card">
            <h1>Experiment: \${project.name}</h1>
            <p class="text-slate-600 mb-4">\${project.description || 'DOE Magic Export'}</p>
            <p class="text-sm"><strong>Design Used:</strong> \${designName}</p>
        </div>`;

const newCard = `        <div class="card" style="position: relative;">
            <img src="\${logoBase64}" alt="Logo" style="position: absolute; top: 24px; right: 24px; height: 48px; object-fit: contain;">
            <h1>Experiment: \${project.name}</h1>
            <p class="text-slate-600 mb-4">\${project.description || 'DOE Magic Export'}</p>
            <p class="text-sm"><strong>Design Used:</strong> \${designName}</p>
        </div>`;

content = content.replace(oldCard, newCard);

// Move Design Matrix card below Responses card
const dmStartIdx = content.indexOf('<div class="card overflow-x-auto">\n            <h2>Design Matrix & Results</h2>');
const dmEndIdx = content.indexOf('</div>\n    </div>\n</body>', dmStartIdx) + 6;

if (dmStartIdx !== -1) {
  const dmBlock = content.substring(dmStartIdx, dmEndIdx);
  content = content.substring(0, dmStartIdx) + content.substring(dmEndIdx);

  const insertAfter = `        <div class="grid-2">
            <div class="card">
                <h2>Factors</h2>
                <table>
                    <thead><tr><th>Name</th><th>Type</th><th>Min</th><th>Max</th><th>Unit</th></tr></thead>
                    <tbody>\`;
                      project.factors.forEach(f => {
    html += \`<tr><td>\${f.name}</td><td>\${f.type}</td><td>\${f.min}</td><td>\${f.max}</td><td>\${f.unit || '-'}</td></tr>\`;
  });
  html += \`</tbody>
                </table>
            </div>
            <div class="card">
                <h2>Responses</h2>
                <table>
                    <thead><tr><th>Name</th><th>Goal</th><th>Target</th><th>Unit</th></tr></thead>
                    <tbody>\`;
                      project.responses.forEach(r => {
    html += \`<tr><td>\${r.name}</td><td>\${r.goal}</td><td>\${r.targetValue ?? '-'}</td><td>\${r.unit || '-'}</td></tr>\`;
  });
  html += \`</tbody>
                </table>
            </div>
        </div>\`;`;
        
  // find insert position
  const insertIdx = content.indexOf('</div>\n        </div>`;\n\n  html += `\n        <div class="card">\n            <h2>Analysis & Optimization</h2>');
  
  if (insertIdx !== -1) {
    // we need to insert dmBlock right before <div class="card"> Analysis & Optimization
    // Let's rewrite the Design Matrix string generation properly since it uses JS loops
    
    // First, let's just replace it via regex
  }
}
fs.writeFileSync('src/utils/htmlExport.ts', content);
