import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

code = code.replace(
  /<td className="px-1 py-0\.5 font-medium flex items-center gap-2">/g,
  '<td className="px-1 py-0.5 font-medium"><div className="flex items-center gap-2">'
);
code = code.replace(
  /<\/span>\s*<\/td>/g,
  '</span></div></td>'
);

code = code.replace(
  /<td className="px-1 py-0\.5 flex items-center gap-2">/g,
  '<td className="px-1 py-0.5"><div className="flex items-center gap-2">'
);
code = code.replace(
  /<\/div>\s*<\/td>/g,
  '</div></div></td>'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
