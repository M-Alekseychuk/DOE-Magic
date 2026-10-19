const fs = require('fs');

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const importJstat = `// @ts-ignore\nimport jstat from 'jstat';\nconst jStat = jstat.default || jstat;\n`;
if (!content.includes('import jstat')) {
    content = content.replace("import Plot from 'react-plotly.js';", "import Plot from 'react-plotly.js';\n" + importJstat);
}

// Modify useMemo for analysisResults to include ANOVA data
// I will write a regex or just substring replace.
