import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

const target = `    // Calculate Actual vs Predicted and Studentized Residuals
    const actualByPredicted: any[] = [];
    const studentizedResiduals: any[] = [];
    const h: number[] = [];
    
    // tCrit for 95% limit in studentized residuals (approximate with t-dist or normal if large df)
    // using jStat for accurate studentized limit (Bonferroni corrected or not)
    const tLimit = df_error > 0 ? Math.abs(jStat.studentt.inv(0.05 / 2, df_error)) : 3;

    validRuns.forEach((run, idx) => {
        const actual = Y[idx][0];
        let pred = 0;
        for (let i = 0; i < numTerms; i++) {
            pred += beta[i] * X[idx][i];
        }
        
        // Calculate leverage h_ii
        let hii = 0;
        for (let i = 0; i < numTerms; i++) {
            if (aliased[i]) continue;
            let sum = 0;
            for (let j = 0; j < numTerms; j++) {
                if (aliased[j]) continue;
                sum += X[idx][i] * invXtX[i][j] * X[idx][j];
            }
            hii += sum;
        }
        h.push(hii);
        
        const residual = actual - pred;
        let studentized = null;
        if (mse > 0 && hii < 1) {
            studentized = residual / Math.sqrt(mse * (1 - hii));
        }
        
        actualByPredicted.push({ actual, predicted: pred });
        studentizedResiduals.push({ run: idx + 1, studentized, limit: tLimit });
    });`;

const replacement = `    // Calculate Actual vs Predicted and Studentized Residuals
    const actualByPredicted: any[] = [];
    const studentizedResiduals: any[] = [];
    const h: number[] = [];
    
    // tCrit for 95% limit in studentized residuals (approximate with t-dist or normal if large df)
    // using jStat for accurate studentized limit (Bonferroni corrected or not)
    const tLimit = df_error > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / 2, df_error)) : 3;
    const bonferroniLimit = df_error > 0 ? Math.abs(jStat.studentt.inv(1 - 0.05 / (2 * nRuns), df_error)) : 3;

    validRuns.forEach((run, idx) => {
        const actual = Y[idx][0];
        let pred = 0;
        for (let i = 0; i < numTerms; i++) {
            pred += beta[i] * X[idx][i];
        }
        
        // Calculate leverage h_ii
        let hii = 0;
        for (let i = 0; i < numTerms; i++) {
            if (aliased[i]) continue;
            let sum = 0;
            for (let j = 0; j < numTerms; j++) {
                if (aliased[j]) continue;
                sum += X[idx][i] * invXtX[i][j] * X[idx][j];
            }
            hii += sum;
        }
        h.push(hii);
        
        const residual = actual - pred;
        let studentized = 0;
        if (mse > 1e-9 && hii < 0.9999) {
            studentized = residual / Math.sqrt(mse * (1 - hii));
        }
        
        actualByPredicted.push({ actual, predicted: pred });
        studentizedResiduals.push({ run: idx + 1, studentized, limit: tLimit, bonferroniLimit });
    });`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/ProjectAnalysis.tsx', content);
    console.log("Successfully updated residuals calculation.");
} else {
    console.log("Could not find target block to update in ProjectAnalysis.tsx");
}
