import fs from 'fs';

let contentProject = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// For ProjectAnalysis, let's just make the Y-axis div wider and move it to the left so it stops overlapping the axis labels
const targetDiv = `<div className="absolute left-[-5px] top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">`;
const replaceDiv = `<div className="absolute left-[-15px] top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">`;
contentProject = contentProject.replace(targetDiv, replaceDiv);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', contentProject);

// For ResidualsPlots, we need to add tickFormatters
let contentResiduals = fs.readFileSync('src/components/ResidualsPlots.tsx', 'utf8');

// Actual by predicted plot
const targetAP_X = `<XAxis type="number" dataKey="predicted" name="Predicted" domain={domain} tick={{fontSize: 10}} label={{ value: 'Predicted', position: 'insideBottom', offset: -10, fontSize: 10 }} />`;
const replaceAP_X = `<XAxis type="number" dataKey="predicted" name="Predicted" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} label={{ value: 'Predicted', position: 'insideBottom', offset: -10, fontSize: 10 }} />`;
contentResiduals = contentResiduals.replace(targetAP_X, replaceAP_X);

const targetAP_Y = `<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} label={{ value: 'Actual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} />`;
const replaceAP_Y = `<YAxis type="number" dataKey="actual" name="Actual" domain={domain} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={60} label={{ value: 'Actual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} />`;
contentResiduals = contentResiduals.replace(targetAP_Y, replaceAP_Y);


// Studentized Residuals plot
const targetSR_X = `<XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} label={{ value: 'Run Number', position: 'insideBottom', offset: -10, fontSize: 10 }} />`;
const replaceSR_X = `<XAxis type="number" dataKey="run" name="Run" tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(0)} label={{ value: 'Run Number', position: 'insideBottom', offset: -10, fontSize: 10 }} />`;
contentResiduals = contentResiduals.replace(targetSR_X, replaceSR_X);

const targetSR_Y = `<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} />`;
const replaceSR_Y = `<YAxis type="number" dataKey="studentized" name="Studentized Residual" domain={[-yMax, yMax]} tick={{fontSize: 10}} tickFormatter={(val) => val.toFixed(2)} width={60} label={{ value: 'Studentized Residual', angle: -90, position: 'insideLeft', offset: -10, fontSize: 10 }} />`;
contentResiduals = contentResiduals.replace(targetSR_Y, replaceSR_Y);


fs.writeFileSync('src/components/ResidualsPlots.tsx', contentResiduals);
console.log('Fixed residuals files');
