const fs = require('fs');
let content = fs.readFileSync('src/components/RobustnessSimulation.tsx', 'utf8');

// fix dropdown
content = content.replace(
  '<option key={r.id} value={r.id}>{r.name}</option>\n              ))}\n              <option value="joint" className="font-bold">All Responses (Joint Defect Rate)</option>\n              <option value="joint">All Responses (Joint Defect Rate)</option>\n              ))}',
  '<option key={r.id} value={r.id}>{r.name}</option>\n              ))}\n              <option value="joint" className="font-bold">All Responses (Joint Defect Rate)</option>'
);

// fix end of render
content = content.replace(
  '        ) : () : (',
  '        ) : ('
);

fs.writeFileSync('src/components/RobustnessSimulation.tsx', content);
