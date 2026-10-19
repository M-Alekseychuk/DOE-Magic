import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Compact Effect Summary table
code = code.replace(/<td className="px-2 py-1 /g, '<td className="px-1 py-0.5 ');
code = code.replace(/<th className="px-2 py-1 /g, '<th className="px-1 py-1 ');

// Compact Lack Of Fit table
code = code.replace(/<td className="px-2 py-1">/g, '<td className="px-1 py-0.5">');
code = code.replace(/<td className="px-2 py-1 text-right/g, '<td className="px-1 py-0.5 text-right');
code = code.replace(/<th className="px-2 py-1/g, '<th className="px-1 py-1');

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
