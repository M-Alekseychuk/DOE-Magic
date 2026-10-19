import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const targetChart = `<ScatterChart margin={{ top: 10, right: 30, left: 30, bottom: 20 }}>`;
const replaceChart = `<ScatterChart margin={{ top: 10, right: 30, left: 40, bottom: 20 }}>`;

content = content.replace(targetChart, replaceChart);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed Y-axis offset');
