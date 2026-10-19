import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /if \(ef\.isExcluded\) \{/,
  `console.log('Clicked include on', ef.id);
                            if (ef.isExcluded) {`
);

code = code.replace(
  /\} else \{\s*setExcludedTerms\(prev => \[\.\.\.prev, ef\.id\]\);\s*\}/,
  `} else {
                              console.log('Clicked exclude on', ef.id);
                              setExcludedTerms(prev => [...prev, ef.id]);
                            }`
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
