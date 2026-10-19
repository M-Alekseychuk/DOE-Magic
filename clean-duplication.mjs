import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /interactions\.push\(\{\s*f1: project\.factors\[i\],[\s\S]*?interactions\.push\(\{/m;
code = code.replace(regex, 'interactions.push({');

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
