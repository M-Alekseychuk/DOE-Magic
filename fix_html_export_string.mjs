import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// Replace the inner backticks for stats-container
content = content.replace(/document\.getElementById\('stats-container'\)\.innerHTML = `/g, "document.getElementById('stats-container').innerHTML = ' ' + ");
content = content.replace(/<div class="bg-white border border-slate-200 p-3 rounded text-center shadow-sm">\\n                    <div class="text-xs text-slate-500 uppercase tracking-widest font-bold">Model p-value<\/div>\\n                    <div class="text-lg font-bold text-slate-800">\$\{data.p < 0.0001 \? '<0.0001' : data.p.toFixed\(4\)\}<\/div>\\n                <\/div>\\n            `;/g, "'<div class=\"bg-white border border-slate-200 p-3 rounded text-center shadow-sm\">' + '<div class=\"text-xs text-slate-500 uppercase tracking-widest font-bold\">Model p-value</div>' + '<div class=\"text-lg font-bold text-slate-800\">' + (data.p < 0.0001 ? '<0.0001' : data.p.toFixed(4)) + '</div>' + '</div>';");

content = content.replace(/optHtml \+= `\$\{f.factor.name\}: <strong>\$\{f.optimalValue\}<\/strong> \$\{f.factor.unit \|\| ''\} \(Coded: \$\{f.codedValue.toFixed\(2\)\}\)<br\/>`;/g, "optHtml += f.factor.name + ': <strong>' + f.optimalValue + '</strong> ' + (f.factor.unit || '') + ' (Coded: ' + f.codedValue.toFixed(2) + ')<br/>';");

content = content.replace(/optHtml \+= `<br\/>Predicted Response: <strong>\$\{data.optimalConditions.expectedY.toFixed\(4\)\}<\/strong> \(Desirability: \$\{data.optimalConditions.desirability.toFixed\(4\)\}\)`;/g, "optHtml += '<br/>Predicted Response: <strong>' + data.optimalConditions.expectedY.toFixed(4) + '</strong> (Desirability: ' + data.optimalConditions.desirability.toFixed(4) + ')';");

fs.writeFileSync('src/utils/htmlExport.ts', content);

