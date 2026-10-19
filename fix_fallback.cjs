const fs = require('fs');
let content = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');

// Ensure activeResponse is defined if not 'joint'. If it's undefined and not 'joint', default it to the first response.
const activeResponseStart = content.indexOf('  const activeResponse = project.responses.find(r => r.id === selectedResponseId);');
const activeResponseEnd = activeResponseStart + '  const activeResponse = project.responses.find(r => r.id === selectedResponseId);'.length;

const newActiveResponse = `  let activeResponse = project.responses.find(r => r.id === selectedResponseId);
  if (!activeResponse && selectedResponseId !== 'joint' && project.responses.length > 0) {
    activeResponse = project.responses[0];
  }`;

content = content.substring(0, activeResponseStart) + newActiveResponse + content.substring(activeResponseEnd);

fs.writeFileSync('src/components/RobustnessSimulation.tsx', content);
