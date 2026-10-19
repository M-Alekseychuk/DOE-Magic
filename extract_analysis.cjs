const fs = require('fs');

let pa = fs.readFileSync('src/components/ProjectAnalysis.tsx', 'utf8');

// Find start and end of analysisResults
const startIdx = pa.indexOf('const analysisResults = useMemo(() => {');
const endIdx = pa.indexOf('  }, [project, hasData, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue]);');

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find analysisResults useMemo block");
    process.exit(1);
}

const beforeBlock = pa.substring(0, startIdx);
const afterBlock = pa.substring(endIdx + '  }, [project, hasData, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue]);'.length);

let useMemoBody = pa.substring(startIdx + 'const analysisResults = useMemo(() => {'.length, endIdx);

// The body depends on: project, hasData, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue
// Also depends on: jStat (from global import)

let analysisCoreFile = `import jstat from 'jstat';
const jStat = (jstat as any).default || jstat;
import { Project, Response } from '../types';

// Matrix math utilities for OLS
function transpose(m: number[][]) {
    return m[0].map((_, i) => m.map(row => row[i]));
}

function multiply(m1: number[][], m2: number[][]) {
    const res = Array(m1.length).fill(0).map(() => Array(m2[0].length).fill(0));
    for (let i = 0; i < m1.length; i++) {
        for (let j = 0; j < m2[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < m1[0].length; k++) {
                sum += m1[i][k] * m2[k][j];
            }
            res[i][j] = sum;
        }
    }
    return res;
}

function solveOLS(X: number[][], Y: number[][]) {
    const n = X.length;
    const k = X[0].length;
    
    const Xt = transpose(X);
    const XtX = multiply(Xt, X);
    const XtY = multiply(Xt, Y);
    
    const aug: number[][] = [];
    for (let i = 0; i < k; i++) {
        const row = [...XtX[i], XtY[i][0]];
        for (let j = 0; j < k; j++) row.push(i === j ? 1 : 0);
        aug.push(row);
    }
    
    const aliased = new Array(k).fill(false);
    let currentRow = 0;
    const colToRow = new Array(k).fill(-1);
    
    for (let col = 0; col < k; col++) {
        let pivotRow = currentRow;
        let maxVal = 0;
        for (let r = currentRow; r < k; r++) {
            if (Math.abs(aug[r][col]) > maxVal) {
                maxVal = Math.abs(aug[r][col]);
                pivotRow = r;
            }
        }
        
        if (maxVal < 1e-9) {
            aliased[col] = true;
            continue;
        }
        
        const pivotVal = aug[pivotRow][col];
        const temp = aug[currentRow];
        aug[currentRow] = aug[pivotRow];
        aug[pivotRow] = temp;
        
        for (let j = col; j < k + 1 + k; j++) {
            aug[currentRow][j] /= pivotVal;
        }
        
        for (let r = 0; r < k; r++) {
            if (r !== currentRow) {
                const factor = aug[r][col];
                for (let j = col; j < k + 1 + k; j++) {
                    aug[r][j] -= factor * aug[currentRow][j];
                }
            }
        }
        
        colToRow[col] = currentRow;
        currentRow++;
    }
    
    const rank = currentRow;
    const beta = new Array(k).fill(0);
    const diagInv = new Array(k).fill(0);
    const invXtX = Array(k).fill(0).map(() => Array(k).fill(0));
    
    for (let col = 0; col < k; col++) {
        if (!aliased[col]) {
            const r = colToRow[col];
            beta[col] = aug[r][k];
            diagInv[col] = Math.max(0, aug[r][k + 1 + col]);
            for (let c2 = 0; c2 < k; c2++) {
                if (!aliased[c2]) {
                    invXtX[col][c2] = aug[r][k + 1 + c2];
                }
            }
        }
    }
    
    return { beta, diagInv, invXtX, aliased, rank };
}

export function computeAnalysis(project: Project, activeResponse: Response, excludedTerms: string[], effectiveGoal: string | undefined, effectiveTargetValue: number | undefined) {
    const hasData = project.runs.length > 0 && project.factors.length > 0;
${useMemoBody}
}
`;

fs.writeFileSync('src/utils/analysisCore.ts', analysisCoreFile);

// Remove the matrix math utilities from ProjectAnalysis.tsx
// They start around line 67: function transpose(m: number[][]) { ... }
// and end around line 164: }

const mathStart = pa.indexOf('// Matrix math utilities for OLS');
const mathEnd = pa.indexOf('export default function ProjectAnalysis');
const strippedPa = pa.substring(0, mathStart) + '\nimport { computeAnalysis } from "../utils/analysisCore";\n\n' + pa.substring(mathEnd);

// Replace the useMemo block with a call to the new function
const finalPa = strippedPa.replace(
  '  const analysisResults = useMemo(() => {',
  '  const analysisResults = useMemo(() => {\n    if (!hasData || !activeResponse) return null;\n    return computeAnalysis(project, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue);'
).replace(
  useMemoBody + '  }, [project, hasData, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue]);',
  '  }, [project, hasData, activeResponse, excludedTerms, effectiveGoal, effectiveTargetValue]);'
);

fs.writeFileSync('src/components/ProjectAnalysis.tsx', finalPa);

