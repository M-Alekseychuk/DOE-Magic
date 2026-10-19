import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const target = `<XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} height={40} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: 0, fontSize: 10 }} />`;
const replace = `<XAxis type="number" dataKey="x" domain={[interactionData.f1.min, interactionData.f1.max]} ticks={[interactionData.f1.min, (interactionData.f1.min + interactionData.f1.max) / 2, interactionData.f1.max]} tick={{fontSize: 10}} tickFormatter={(val) => val.toString()} height={45} label={{ value: interactionData.f1.name, position: 'insideBottom', offset: -5, fontSize: 10 }} />`;
content = content.replace(target, replace);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
