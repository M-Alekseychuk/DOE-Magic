import fs from 'fs';
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

content = content.replace(/label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', fontSize: 10 }}/g,
"label={{ value: 'Mean Response', angle: -90, position: 'insideLeft', dx: -15, fontSize: 10 }}");

// Half normal plot label is absolute div. The user was talking about "the Graph is getting moved".
// If they complained about Half-Normal, wait, the Half-Normal div has `absolute left-0`.
// If I changed `margin={{left: 60}}` on Half-Normal earlier, it means the graph was moved!
