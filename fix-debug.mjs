import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /<div className="bg-red-100 p-2 text-xs font-mono">DEBUG excludedTerms: \{JSON\.stringify\(excludedTerms\)\}<\/div>\n          <div className="bg-blue-100 p-2 text-xs font-mono">DEBUG activeTerms: \{JSON\.stringify\(activeTerms\.map\(t => t\.id\)\)\}<\/div>/,
  ""
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
