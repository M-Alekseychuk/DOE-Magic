import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /\{opt\.optimalValue\} \{opt\.factor\.unit\}\s*<\/span><\/div><\/div><\/td>/m,
  "{opt.optimalValue} {opt.factor.unit}\n                      </span></td>"
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
