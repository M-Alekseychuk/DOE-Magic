const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Find the first instance of '    return { response: activeResponse, effects, optimalSettings, halfNormalData, bestPred, rSquared, adjRSquared, p, nRuns, paretoThreshold, effectSummary, lackOfFit };'
const badSplit = 'lackOfFit };oltip, ResponsiveContainer';
const idx = code.indexOf(badSplit);
if (idx > -1) {
    // The top part is correct up to `lackOfFit };`
    const topPart = code.substring(0, idx + 'lackOfFit };'.length);
    // The bottom part is from the original file's `return { response... paretoThreshold };` 
    // Wait, let's find `  }, [project, hasData, activeResponse]);`
    const originalEnd = `  }, [project, hasData, activeResponse]);`;
    const endIdx = code.indexOf(originalEnd, idx);
    const bottomPart = code.substring(endIdx);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', topPart + '\n' + bottomPart);
    console.log("Fixed.");
}
