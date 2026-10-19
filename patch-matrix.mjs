import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const regex = /const X: number\[\]\[\] = \[\];[\s\S]*?\/\/ 3\. Map Beta back to UI objects/m;
const newMatrixLogic = `
    // Build term definitions based on what's NOT excluded
    const activeTerms: any[] = [];
    for (let i = 0; i < k; i++) {
        if (!excludedTerms.includes(project.factors[i].id)) {
            activeTerms.push({ type: 'main', factor: project.factors[i], idx: i });
        }
    }
    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            const intId = \`\${project.factors[i].id}*\${project.factors[j].id}\`;
            if (!excludedTerms.includes(intId)) {
                activeTerms.push({ type: 'interaction', f1: project.factors[i], f2: project.factors[j], i, j, id: intId });
            }
        }
    }

    const X: number[][] = [];
    const Y: number[][] = [];
    
    validRuns.forEach(run => {
        const res = Number(run.responses[activeResponse.id]);
        Y.push([res]);
        
        const row = [1]; // Intercept
        
        // Cache scaled x vals for this run
        const x_scaled = project.factors.map(f => {
            const val = Number(run.factors[f.id]);
            const mid = (f.min + f.max) / 2;
            const range = (f.max - f.min) || 1;
            return 2 * (val - mid) / range;
        });

        activeTerms.forEach(term => {
            if (term.type === 'main') {
                row.push(x_scaled[term.idx]);
            } else {
                row.push(x_scaled[term.i] * x_scaled[term.j]);
            }
        });
        
        X.push(row);
    });

    // 2. Perform Robust OLS solving
    const { beta, diagInv, aliased, rank } = solveOLS(X, Y);
    const numTerms = X[0].length;

    // 3. Map Beta back to UI objects
`;

code = code.replace(regex, newMatrixLogic);
fs.writeFileSync('src/components/ProjectAnalysis.tsx', code);
