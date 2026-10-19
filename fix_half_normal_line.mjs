import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const target = `<Line type="linear" dataKey="y" data={analysisResults.halfNormalLine} stroke="#f87171" strokeWidth={2} dot={false} activeDot={false} legendType="none" />`;
const replacement = `<ReferenceLine segment={[{x: 0, y: 0}, {x: analysisResults.halfNormalLine[1]?.x || 10, y: analysisResults.halfNormalLine[1]?.y || 10}]} stroke="#f87171" strokeWidth={2} />`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
    console.log("Fixed Half Normal Line");
} else {
    console.log("Could not find the target line to replace");
}
