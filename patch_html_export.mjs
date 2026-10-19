import fs from 'fs';

let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// The issue is that the backticks were escaped as \` but JS interpreted it literally when writing.
// Wait, no, the generated code in htmlExport.ts has:
// options += `<option value="${i}">${f.name}</option>`;
// But because it's inside: const html = ` ... options += \`<option value="\${i}">\${f.name}</option>\`; ... ` 
// The backtick inside the backtick template literal breaks TS!

// To fix it, I'll replace the inner template literals with standard string concatenation or just fix the backticks in the generated file.

content = content.replace(/options \+= `<option value="\${i}">\${f.name}<\/option>`;/g, 'options += "<option value=\\"" + i + "\\">" + f.name + "</option>";');
content = content.replace(/name: `\${f2.name} = Low \(\${f2.min}\)`/g, 'name: f2.name + " = Low (" + f2.min + ")"');
content = content.replace(/name: `\${f2.name} = High \(\${f2.max}\)`/g, 'name: f2.name + " = High (" + f2.max + ")"');

fs.writeFileSync('src/utils/htmlExport.ts', content);

