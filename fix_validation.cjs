const fs = require('fs');

let ctx = fs.readFileSync('src/context/ProjectContext.tsx', 'utf8');

ctx = ctx.replace(
  'if (Array.isArray(parsed) && parsed.length > 0) {',
  `if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate that essential fields exist to prevent crashes
        const isValid = parsed.every(p => p && p.id && Array.isArray(p.factors) && Array.isArray(p.responses) && Array.isArray(p.runs));
        if (isValid) {
          return parsed;
        } else {
          console.warn('Cached projects are malformed, ignoring local cache.');
        }`
);

fs.writeFileSync('src/context/ProjectContext.tsx', ctx);
