import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// I will just re-apply the onClick with preventDefault and compact layout.
const regex = /<td className="px-2 py-1 font-medium flex items-center gap-2">[\s\S]*?<\/td>/g;
const replacer = (match) => {
  if (match.includes("setExcludedTerms")) {
    return `<td className="px-2 py-1 font-medium flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          if (ef.isExcluded) {
                            setExcludedTerms(prev => prev.filter(id => id !== ef.id));
                          } else {
                            setExcludedTerms(prev => [...prev, ef.id]);
                          }
                        }}
                        className={\`text-[9px] px-1 py-0 border rounded shadow-sm transition-colors \${ef.isExcluded ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-900/30 border-b-2 hover:border-brand-300 dark:hover:border-brand-700'}\`}
                      >
                        {ef.isExcluded ? 'Include' : 'Exclude'}
                      </button>
                      <span className={ef.isExcluded ? 'line-through text-slate-400 font-normal' : ''}>{ef.name}</span>
                    </td>`;
  }
  return match;
};
code = code.replace(regex, replacer);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
