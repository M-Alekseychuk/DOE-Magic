import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const halfNormalBlockMatch = content.match(/const sortedForHalfNormal = .*?;[\s\S]*?const paretoData = .*?;/);
if (halfNormalBlockMatch) {
    const replacement = `const sortedForHalfNormal = [...combinedEffectsForPlot].sort((a, b) => a.tRatio - b.tRatio);
    const halfNormalData = sortedForHalfNormal.map((e, index) => {
      const i = index + 1;
      const p = 0.5 + 0.5 * ((i - 0.5) / Math.max(1, sortedForHalfNormal.length));
      return { ...e, expected: normSInv(p), significant: e.tRatio > tLimitPareto };
    });
    
    // Fit a line to the smallest 50% of effects
    let halfNormalSlope = 1;
    const nSmallest = Math.max(1, Math.floor(halfNormalData.length * 0.5));
    let sumX2 = 0;
    let sumXY = 0;
    for (let i = 0; i < nSmallest; i++) {
        sumX2 += halfNormalData[i].tRatio * halfNormalData[i].tRatio;
        sumXY += halfNormalData[i].tRatio * halfNormalData[i].expected;
    }
    if (sumX2 > 0) {
        halfNormalSlope = sumXY / sumX2;
    }
    const maxT = halfNormalData.length > 0 ? Math.max(...halfNormalData.map(d => d.tRatio)) : 1;
    const halfNormalLine = [
        { x: 0, y: 0 },
        { x: maxT, y: halfNormalSlope * maxT }
    ];

    const paretoData = [...combinedEffectsForPlot].sort((a, b) => b.tRatio - a.tRatio);
    const bonferroniLimitPareto = df_error > 0 && activeTerms.length > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / (2 * activeTerms.length), df_error)) : 3.5;
`;
    content = content.replace(halfNormalBlockMatch[0], replacement);
} else {
    console.log("Could not match half normal block!");
}

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
