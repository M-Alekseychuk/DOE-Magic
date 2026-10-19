const fs = require('fs');
let content = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');

const specStart = content.indexOf('<div className="mb-4">\n            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Specification Limits</h4>');
const specEnd = content.indexOf('<div className="mb-4">\n            <label className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1 font-semibold">\n              Simulations');

if (specStart === -1 || specEnd === -1) {
    console.error("Could not find Specification Limits block");
    process.exit(1);
}

const newSpecUI = `<div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">Specification Limits</h4>
            {selectedResponseId === 'joint' ? (
              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
                {project.responses.map(r => (
                  <div key={r.id} className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">{r.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">LSL (Lower)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={specLimits[r.id]?.lsl ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '.');
                            if (val === '' || /^\\-?\\d*\\.?\\d*$/.test(val)) {
                              setSpecLimits(prev => ({
                                ...prev,
                                [r.id]: { ...(prev[r.id] || {}), lsl: val }
                              }));
                            }
                          }}
                          className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">USL (Upper)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={specLimits[r.id]?.usl ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '.');
                            if (val === '' || /^\\-?\\d*\\.?\\d*$/.test(val)) {
                              setSpecLimits(prev => ({
                                ...prev,
                                [r.id]: { ...(prev[r.id] || {}), usl: val }
                              }));
                            }
                          }}
                          className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">LSL (Lower)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={specLimits[activeResponse?.id || '']?.lsl ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '.');
                      if (val === '' || /^\\-?\\d*\\.?\\d*$/.test(val)) {
                        setSpecLimits(prev => ({
                          ...prev,
                          [activeResponse!.id]: { ...(prev[activeResponse!.id] || {}), lsl: val }
                        }));
                      }
                    }}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-slate-500 block mb-0.5">USL (Upper)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={specLimits[activeResponse?.id || '']?.usl ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '.');
                      if (val === '' || /^\\-?\\d*\\.?\\d*$/.test(val)) {
                        setSpecLimits(prev => ({
                          ...prev,
                          [activeResponse!.id]: { ...(prev[activeResponse!.id] || {}), usl: val }
                        }));
                      }
                    }}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}
          </div>
          
          `;

content = content.substring(0, specStart) + newSpecUI + content.substring(specEnd);

fs.writeFileSync('src/components/RobustnessSimulation.tsx', content);
