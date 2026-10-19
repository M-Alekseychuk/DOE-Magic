const fs = require('fs');
let content = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');

// For lsl updates
content = content.replace(
  /\{ \.\.\.\(prev\[r\.id\] \|\| \{\}\), lsl: val \}/g,
  '{ lsl: val, usl: prev[r.id]?.usl ?? "" }'
);
content = content.replace(
  /\{ \.\.\.\(prev\[activeResponse!\.id\] \|\| \{\}\), lsl: val \}/g,
  '{ lsl: val, usl: prev[activeResponse!.id]?.usl ?? "" }'
);

// For usl updates
content = content.replace(
  /\{ \.\.\.\(prev\[r\.id\] \|\| \{\}\), usl: val \}/g,
  '{ lsl: prev[r.id]?.lsl ?? "", usl: val }'
);
content = content.replace(
  /\{ \.\.\.\(prev\[activeResponse!\.id\] \|\| \{\}\), usl: val \}/g,
  '{ lsl: prev[activeResponse!.id]?.lsl ?? "", usl: val }'
);

fs.writeFileSync('src/components/RobustnessSimulation.tsx', content);
