import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /onClick=\{\(e\) => \{[\s\S]*?\}\}/m,
  `onClick={(e) => {
                            e.preventDefault();
                            if (ef.isExcluded) {
                              setExcludedTerms(prev => prev.filter(item => item !== ef.id));
                            } else {
                              setExcludedTerms(prev => [...prev, ef.id]);
                            }
                          }}`
);

code = code.replace(
  /<tr key=\{idx\}/,
  '<tr key={ef.id}'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
