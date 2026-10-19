import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regexTable = /<td className="px-2 py-1 font-medium">\{ef\.name\}<\/td>/m;
const newTableItem = `
                    <td className="px-2 py-1 font-medium flex items-center gap-2">
                      <button 
                        onClick={() => {
                          if (ef.isExcluded) {
                            setExcludedTerms(prev => prev.filter(id => id !== ef.id));
                          } else {
                            setExcludedTerms(prev => [...prev, ef.id]);
                          }
                        }}
                        className="text-[9px] px-1.5 py-0.5 border rounded border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 shadow-sm"
                      >
                        {ef.isExcluded ? 'Include' : 'Exclude'}
                      </button>
                      <span className={ef.isExcluded ? 'line-through text-slate-400' : ''}>{ef.name}</span>
                    </td>
`;
code = code.replace(regexTable, newTableItem);

const regexTr = /<tr key=\{idx\} className="border-b border-slate-100">/m;
code = code.replace(regexTr, `<tr key={idx} className={\`border-b border-slate-100 \${ef.isExcluded ? 'bg-slate-50 dark:bg-slate-800/50' : ''}\`}>`);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
