const fs = require('fs');
let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// text-blue-300 inside CI
content = content.replace(
  'text-sm font-bold font-mono text-blue-300 mt-0.5',
  'text-sm font-bold font-mono text-blue-600 dark:text-blue-300 mt-0.5'
);

// text-purple-300 inside PI
content = content.replace(
  'text-sm font-bold font-mono text-purple-300 mt-0.5',
  'text-sm font-bold font-mono text-fuchsia-600 dark:text-fuchsia-300 mt-0.5'
);

// <strong className="text-white">
content = content.replace(
  /<strong className="text-white">/g,
  '<strong className="text-slate-800 dark:text-white">'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
