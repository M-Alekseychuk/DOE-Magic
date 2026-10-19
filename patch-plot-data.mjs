import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /const combinedEffectsForPlot = \[\s*\.\.\.\(effectsLevelFilter !== 'secondary' \? effects\.filter\(e => \!e\.isAliased\)\.map\(e => \(\{ name: e\.factor\.name, absEffect: e\.absEffect, direction: e\.direction, factor: e\.factor \}\)\) : \[\]\),\s*\.\.\.\(effectsLevelFilter !== 'primary' \? interactions\.filter\(i => \!i\.isAliased\)\.map\(i => \(\{ name: `\$\{i\.f1\.name\}\*\$\{i\.f2\.name\}`, absEffect: i\.absEffect, direction: i\.direction, factor: \{ name: `\$\{i\.f1\.name\}\*\$\{i\.f2\.name\}` \} \}\)\) : \[\]\)\s*\];/m;

const newLogic = `
    const combinedEffectsForPlot = [
      ...(effectsLevelFilter !== 'secondary' ? effects.filter(e => !e.isAliased && !e.isExcluded).map(e => ({ name: e.factor.name, absEffect: e.absEffect, direction: e.direction, factor: e.factor })) : []),
      ...(effectsLevelFilter !== 'primary' ? interactions.filter(i => !i.isAliased && !i.isExcluded).map(i => ({ name: \`\${i.f1.name}*\${i.f2.name}\`, absEffect: i.absEffect, direction: i.direction, factor: { name: \`\${i.f1.name}*\${i.f2.name}\` } })) : [])
    ];
`;

code = code.replace(regex, newLogic);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
