import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// There is a missing parenthesis / malformed div tag right before the ScatterChart
// The error is: Expected ")" but found "width"
// Let's find exactly what happened around line 1153-1160

const badBlock = `<div className="absolute left-[-5px] top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">
                  Half-Normal % Probability
                </div>
                <ResponsiveContainer width="100%" height="100%">`;

// Wait, the error is inside JSX. It's because the ternary operator is returning two sibling elements: the div and the ResponsiveContainer, but they are not wrapped in a Fragment. 
// Ah! In React, if you return multiple siblings from a ternary expression without wrapping them in <>...</>, you get a syntax error.

const fixedBlock = `<>
                <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-slate-700 whitespace-nowrap z-10 font-medium">
                  Half-Normal % Probability
                </div>
                <ResponsiveContainer width="100%" height="100%">`;
content = content.replace(badBlock, fixedBlock);

const endTarget = `                  </ScatterChart>
                </ResponsiveContainer>
              ) : (`;
const endReplace = `                  </ScatterChart>
                </ResponsiveContainer>
                </>
              ) : (`;
content = content.replace(endTarget, endReplace);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
console.log('Fixed React Fragment syntax error');
