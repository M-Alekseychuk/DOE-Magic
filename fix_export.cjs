const fs = require('fs');
let content = fs.readFileSync('src/pages/ProjectView.tsx', 'utf8');

// Replace logWorth with logworth
content = content.replace(/ef\.logWorth/g, 'ef.logworth');

// Replace formatPVal
content = content.replace(/pval\.toFixed\(4\)/g, 'pval.toFixed(5)');

// Replace ss_error with sse
content = content.replace(/lof\.ss_error/g, 'lof.sse');

fs.writeFileSync('src/pages/ProjectView.tsx', content);
