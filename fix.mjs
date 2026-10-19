import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const badSplit = 'lackOfFit };oltip, ResponsiveContainer';
const idx = code.indexOf(badSplit);
if (idx > -1) {
    const topPart = code.substring(0, idx + 'lackOfFit };'.length);
    const originalEnd = `  }, [project, hasData, activeResponse]);`;
    const endIdx = code.indexOf(originalEnd, idx);
    const bottomPart = code.substring(endIdx);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', topPart + '\n' + bottomPart);
    console.log("Fixed.");
}
