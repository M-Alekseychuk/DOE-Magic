const fs = require('fs');

let dash = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const importLogic = `        const json = JSON.parse(event.target?.result as string);
        // Validate JSON
        if (!json || typeof json !== 'object' || !Array.isArray(json.factors) || !Array.isArray(json.responses) || !Array.isArray(json.runs)) {
          alert('Invalid project file format. The file is missing essential DOE structures.');
          return;
        }
        // generate a new id to prevent clashes
        const importedProject = {
          ...json,
          id: uuidv4(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };`;

dash = dash.replace(
  `        const json = JSON.parse(event.target?.result as string);\n        // generate a new id to prevent clashes\n        const importedProject = {\n          ...json,\n          id: uuidv4(),\n          createdAt: Date.now(),\n          updatedAt: Date.now()\n        };`,
  importLogic
);

fs.writeFileSync('src/pages/Dashboard.tsx', dash);
