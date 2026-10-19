const transpose = (m) => m[0].map((_, i) => m.map(row => row[i]));
const multiply = (m1, m2) => {
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
};

function solveOLS(X, Y) {
    const n = X.length;
    const k = X[0].length;
    
    const Xt = transpose(X);
    const XtX = multiply(Xt, X);
    const XtY = multiply(Xt, Y);
    
    // Augment: [ XtX | XtY | I ]
    const aug = [];
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
        
        if (pivotRow !== currentRow) {
            const temp = aug[currentRow];
            aug[currentRow] = aug[pivotRow];
            aug[pivotRow] = temp;
        }
        
        const pivot = aug[currentRow][col];
        for (let c = col; c < aug[currentRow].length; c++) {
            aug[currentRow][c] /= pivot;
        }
        
        for (let r = 0; r < k; r++) {
            if (r !== currentRow) {
                const factor = aug[r][col];
                for (let c = col; c < aug[r].length; c++) {
                    aug[r][c] -= factor * aug[currentRow][c];
                }
            }
        }
        
        colToRow[col] = currentRow;
        currentRow++;
    }
    
    const rank = currentRow;
    const beta = new Array(k).fill(0);
    const diagInv = new Array(k).fill(0);
    
    for (let col = 0; col < k; col++) {
        if (!aliased[col]) {
            const r = colToRow[col];
            beta[col] = aug[r][k];
            diagInv[col] = Math.max(0, aug[r][k + 1 + col]);
        }
    }
    
    return { beta, diagInv, aliased, rank };
}

// 4 corners, 1 rep each.
// Center point, 6 reps.
const X = [
  [1, -1, -1, 1],
  [1, 1, -1, -1],
  [1, -1, 1, -1],
  [1, 1, 1, 1],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
];

// Reconstruct Y from JMP output approximation
// Intercept ~ 96
// A ~ 2
// B ~ 1
// AB ~ 0.5
// let's just make Y slightly noisy
const Y = [
  [92], [96], [94], [98], // Corners
  [96.1], [96.2], [95.9], [96.0], [96.3], [95.8] // Centers
];

const { beta, diagInv, aliased, rank } = solveOLS(X, Y);
console.log("Beta:", beta);
console.log("DiagInv:", diagInv);

let sse = 0;
Y.forEach((y_row, idx) => {
    let pred = 0;
    for (let i = 0; i < 4; i++) {
        pred += beta[i] * X[idx][i];
    }
    sse += Math.pow(y_row[0] - pred, 2);
});
console.log("SSE:", sse);
