import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regexTable = /<td className="px-1 py-0\.5 text-right font-mono">\{ef\.pVal\.toFixed\(5\)\}<\/td>/m;
const replacerTable = `<td className="px-1 py-0.5 text-right font-mono">{!ef.isExcluded && ef.pVal < 1 ? ef.pVal.toFixed(5) : ''}</td>`;
code = code.replace(regexTable, replacerTable);

const regexLogworth = /<span className="w-8 text-right font-mono">\{ef\.logworth\.toFixed\(3\)\}<\/span>/m;
const replacerLogworth = `<span className="w-8 text-right font-mono">{!ef.isExcluded && ef.logworth > 0 ? ef.logworth.toFixed(3) : ''}</span>`;
code = code.replace(regexLogworth, replacerLogworth);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
