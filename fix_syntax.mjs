import fs from 'fs';

let content = fs.readFileSync('src/pages/ProjectView.tsx', 'utf8');
content = content.replace("<button \n            \n          <button \n            onClick={handleExportHTML}", "<button \n            onClick={handleExportHTML}");
fs.writeFileSync('src/pages/ProjectView.tsx', content);

