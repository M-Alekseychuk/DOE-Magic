import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// We need to increase the left margin even more, say from 40 to 60.
const targetChart = `<ScatterChart margin={{ top: 10, right: 30, left: 40, bottom: 20 }}>`;
const replaceChart = `<ScatterChart margin={{ top: 10, right: 30, left: 60, bottom: 20 }}>`;

content = content.replace(targetChart, replaceChart);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed Y-axis offset to 60');
