import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const badRegex = /onClick=\{\(e\) => \{[\s\S]*?\}\}/m;
const goodClick = `onClick={(e) => {
                            e.preventDefault();
                            if (ef.isExcluded) {
                              setExcludedTerms(prev => prev.filter(id => id !== ef.id));
                            } else {
                              setExcludedTerms(prev => [...prev, ef.id]);
                            }
                          }}`;

code = code.replace(badRegex, goodClick);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
