import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

content = content.replace(
    `label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: -10, fontSize: 10 }}`,
    `label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: 0, fontSize: 10 }}`
);

// Also for Half-Normal, let's just make sure we are 100% safe.
// width = 30, margin.left = 45 -> left = 15. dx = -10 -> x = 5.
// Let's make margin.left = 50. Then left = 20. dx = -10 -> x = 10.
// This pushes the graph 5px, totally unnoticeable, but gives 5px more room.
content = content.replace(
    `<ScatterChart margin={{ top: 10, right: 30, left: 45, bottom: 20 }}>`,
    `<ScatterChart margin={{ top: 10, right: 30, left: 50, bottom: 20 }}>`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
