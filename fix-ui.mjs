import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /onClick=\{\(\) => \{\s*console\.log\('Clicked!', ef\.id, ef\.isExcluded, excludedTerms\);\s*if \(ef\.isExcluded\) \{\s*setExcludedTerms\(prev => prev\.filter\(id => id !== ef\.id\)\);\s*\} else \{\s*setExcludedTerms\(prev => \[\.\.\.prev, ef\.id\]\);\s*\}\s*\}\}/g,
  `onClick={(e) => {
                          e.preventDefault();
                          if (ef.isExcluded) {
                            setExcludedTerms(prev => prev.filter(id => id !== ef.id));
                          } else {
                            setExcludedTerms(prev => [...prev, ef.id]);
                          }
                        }}`
);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
