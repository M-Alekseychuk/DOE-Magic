import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Update imports if ChevronRight is not there
if (!code.includes('ChevronRight')) {
    code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, (match, p1) => {
        return "import {" + p1 + ", ChevronRight} from 'lucide-react';";
    });
}

// Effect Summary
code = code.replace(
    /<h3 className="text-\[10px\] uppercase tracking-widest font-bold text-slate-400 mb-2">Effect Summary<\/h3>\s*<div className="overflow-x-auto flex-1 mb-4">/g,
    `<details className="group" open>
            <summary className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 cursor-pointer select-none flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
              Effect Summary
            </summary>
            <div className="overflow-x-auto flex-1 mb-2">`
);

// Parameter Estimates
code = code.replace(
    /<\/div>\s*<h3 className="text-\[10px\] uppercase tracking-widest font-bold text-slate-400 mb-2 mt-4">Parameter Estimates<\/h3>\s*<div className="overflow-x-auto mb-4">/g,
    `</div>
          </details>

          <details className="group border-t border-slate-100 dark:border-slate-800 pt-3" open>
            <summary className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 cursor-pointer select-none flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
              Parameter Estimates
            </summary>
            <div className="overflow-x-auto mb-2">`
);

// Effect Tests
code = code.replace(
    /<\/div>\s*<h3 className="text-\[10px\] uppercase tracking-widest font-bold text-slate-400 mb-2 mt-4">Effect Tests<\/h3>\s*<div className="overflow-x-auto mb-4">/g,
    `</div>
          </details>

          <details className="group border-t border-slate-100 dark:border-slate-800 pt-3" open>
            <summary className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 cursor-pointer select-none flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
              Effect Tests
            </summary>
            <div className="overflow-x-auto mb-2">`
);

// Lack of Fit (Original didn't have mt-4 before we injected tables, but now it does because we prepended tables to it? No, wait, let's just match "Lack Of Fit")
code = code.replace(
    /<\/div>\s*<h3 className="text-\[10px\] uppercase tracking-widest font-bold text-slate-400 mb-2( mt-4)?">Lack Of Fit<\/h3>\s*<div className="overflow-x-auto">/g,
    `</div>
          </details>

          <details className="group border-t border-slate-100 dark:border-slate-800 pt-3" open>
            <summary className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 cursor-pointer select-none flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
              Lack Of Fit
            </summary>
            <div className="overflow-x-auto">`
);

// Close Lack of Fit
code = code.replace(
    /<\/table>\s*<\/div>\s*<\/div>\s*\{\/\* Main Effects Plot \*\/\}/g,
    `</table>
            </div>
          </details>
        </div>

        {/* Main Effects Plot */}`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
