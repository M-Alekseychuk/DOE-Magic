import fs from 'fs';

// --- ResidualsPlots.tsx ---
let res = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

// Actual By Predicted
res = res.replace(
  /<div className="h-\[250px\] w-full">\s*<ResponsiveContainer width="100%" height="100%">\s*<ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 65 }}>\s*<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" \/>\s*<XAxis type="number" dataKey="predicted" name="Predicted" domain={domain} tick={{fontSize: 10}} tickFormatter={\(val\) => val.toFixed\(2\)} label={{ value: 'Predicted', position: 'insideBottom', offset: -10, fontSize: 10 }} \/>\s*<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={\(val\) => val.toFixed\(2\)} width={65} label={{ value: 'Actual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }} \/>/,
  `<div className="h-[250px] w-full flex">
        <div className="flex items-center justify-center pr-2 shrink-0">
          <span className="text-[11px] text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Actual</span>
        </div>
        <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" dataKey="predicted" name="Predicted" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} label={{ value: 'Predicted', position: 'insideBottom', offset: -15, fontSize: 10 }} />
            <YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={45} />`
);

res = res.replace(
  /<\/ScatterChart>\s*<\/ResponsiveContainer>\s*<\/div>\s*<\/div>\s*}/,
  `          </ScatterChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}`
);

// Studentized Residuals
res = res.replace(
  /<div className="h-\[250px\] w-full">\s*<ResponsiveContainer width="100%" height="100%">\s*<ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 65 }}>\s*<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" \/>\s*<XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} tickFormatter={\(val\) => val.toFixed\(0\)} label={{ value: 'Run Number', position: 'insideBottom', offset: -10, fontSize: 10 }} \/>\s*<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={\[-yMax, yMax\]} tick={{fontSize: 10}} tickFormatter={\(val\) => val.toFixed\(2\)} width={65} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }} \/>/,
  `<div className="h-[250px] w-full flex">
        <div className="flex items-center justify-center pr-2 shrink-0">
          <span className="text-[11px] text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Studentized Residual</span>
        </div>
        <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(0)} label={{ value: 'Run Number', position: 'insideBottom', offset: -15, fontSize: 10 }} />
            <YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={45} />`
);

res = res.replace(
  /<\/ScatterChart>\s*<\/ResponsiveContainer>\s*<\/div>\s*<div className="mt-2 text-\[9px\] text-slate-500">/,
  `          </ScatterChart>
        </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-2 text-[9px] text-slate-500">`
);

fs.writeFileSync('src/components/ResidualsPlots.tsx', res);


// --- ProjectAnalysis.tsx ---
let proj = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Half-Normal Plot
proj = proj.replace(
  /<div className="h-64 w-full relative">\s*<ResponsiveContainer width="100%" height="100%">\s*<ScatterChart margin={{ top: 10, right: 30, left: 65, bottom: 20 }}>\s*<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" \/>\s*<XAxis type="number" dataKey="tRatio" name="\|Standardized Effect\|" tick={{fontSize: 10}} label={{ value: '\|Standardized Effect\|', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#334155' }} \/>\s*<YAxis \s*type="number" \s*dataKey="expected" \s*name="Half-Normal % Probability" \s*width={65}\s*tick={{fontSize: 10}} \s*domain={\[-0.1, 2.7\]}\s*label={{ value: 'Half-Normal % Probability', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#334155' }}/,
  `<div className="h-64 w-full relative flex">
              <div className="flex items-center justify-center pr-2 shrink-0">
                <span className="text-[11px] text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Half-Normal % Probability</span>
              </div>
              <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="tRatio" name="|Standardized Effect|" tick={{fontSize: 10}} label={{ value: '|Standardized Effect|', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#334155' }} />
                  
                  <YAxis 
                    type="number" 
                    dataKey="expected" 
                    name="Half-Normal % Probability" 
                    width={35}
                    tick={{fontSize: 10}} 
                    domain={[-0.1, 2.7]}`
);

// The closing div for Half-Normal plot
proj = proj.replace(
  /<\/ScatterChart>\s*<\/ResponsiveContainer>\s*<\/div>\s*<div className="mt-4 flex flex-wrap justify-center gap-4 text-\[10px\] font-semibold">/,
  `                </ScatterChart>
              </ResponsiveContainer>
              </div>
            </div>
            
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] font-semibold">`
);

// DOE Mean Plot
proj = proj.replace(
  /<div className="h-64 w-full">\s*<ResponsiveContainer width="100%" height="100%">\s*<LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 65, bottom: 20 }}>\s*<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" \/>\s*<XAxis dataKey="run" tick={{fontSize: 10}} angle={-45} textAnchor="end" \/>\s*<YAxis domain={\['auto', 'auto'\]} tick={{fontSize: 10}} width={65} label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }} \/>/,
  `<div className="h-64 w-full flex">
              <div className="flex items-center justify-center pr-2 shrink-0">
                <span className="text-[11px] text-slate-600 font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Mean Response</span>
              </div>
              <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={doeMeanData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="run" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
                  <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} width={45} />`
);

// Closing div for DOE Mean plot
proj = proj.replace(
  /<\/LineChart>\s*<\/ResponsiveContainer>\s*\) : \(\s*<div className="h-full flex items-center justify-center text-\[11px\] text-slate-400 italic">No valid run data available.<\/div>\s*\)\s*}\s*<\/div>\s*<\/div>\s*{\/\* Contour & Response Surface Plots \*\/}/,
  `                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic">No valid run data available.</div>
            )}
          </div>
        </div>

        {/* Contour & Response Surface Plots */}`
);


// Interaction Plot
proj = proj.replace(
  /<div className="w-full max-w-lg">\s*<ResponsiveContainer width="100%" height="100%">\s*<LineChart data={interactionData.data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>\s*<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" \/>\s*<XAxis type="number" dataKey="x" domain={\[interactionData.f1.min, interactionData.f1.max\]} ticks={\[interactionData.f1.min, \(interactionData.f1.min \+ interactionData.f1.max\) \/ 2, interactionData.f1.max\]} tick={{fontSize: 10}} tickFormatter={\(val\) => val.toString\(\)} height={45} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -5, fontSize: 10 }} \/>\s*<YAxis domain={\['auto', 'auto'\]} tick={{fontSize: 10}} tickFormatter={\(val\) => val.toFixed\(2\)} width={45} \/>\s*<Tooltip contentStyle={{fontSize: '11px'}} labelFormatter={\(val\) => \`\${interactionData.f1.name}: \${val}\`} \/>\s*<ReferenceLine x={\(interactionData.f1.min \+ interactionData.f1.max\) \/ 2} stroke="#cbd5e1" strokeDasharray="3 3" \/>\s*<Legend wrapperStyle={{fontSize: '11px'}} \/>/,
  `<div className="w-full max-w-lg flex flex-col h-full">
                <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={interactionData.data} margin={{ top: 25, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} height={25} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={45} />
                    <Tooltip contentStyle={{fontSize: '11px'}} labelFormatter={(val) => \`\${interactionData.f1.name}: \${val}\`} />
                    <ReferenceLine x={(interactionData.f1.min + interactionData.f1.max) / 2} stroke="#cbd5e1" strokeDasharray="3 3" />
                    <Legend verticalAlign="top" wrapperStyle={{fontSize: '11px', paddingBottom: '15px'}} />`
);

proj = proj.replace(
  /<\/LineChart>\s*<\/ResponsiveContainer>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*}\s*<\/div>/,
  `                  </LineChart>
                </ResponsiveContainer>
                </div>
                <div className="h-6 flex items-center justify-center shrink-0">
                  <span className="text-[11px] text-slate-600 font-medium">{interactionData.f1.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
</div>`
);


fs.writeFileSync('src/components/ProjectAnalysis.tsx', proj);
console.log('Fixed plots');
