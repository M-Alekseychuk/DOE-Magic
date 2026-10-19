const X = [ [20, 0.8], [40, 0.8], [20, 3], [40, 3], [30, 1.9] ];
const Y = [ 53.35, 40.2, 83.37, 29.82, 46.44 ];
const k = 2;

const meanX = Array(k).fill(0);
let meanY = 0;
for (let i = 0; i < X.length; i++) {
  meanY += Y[i];
  for (let j = 0; j < k; j++) meanX[j] += X[i][j];
}
meanY /= X.length;
for (let j = 0; j < k; j++) meanX[j] /= X.length;

const beta = Array(k).fill(0);
for (let j = 0; j < k; j++) {
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < X.length; i++) {
    cov += (X[i][j] - meanX[j]) * (Y[i] - meanY);
    varX += Math.pow(X[i][j] - meanX[j], 2);
  }
  beta[j] = varX > 0 ? cov / varX : 0;
}

const getTrend = (x) => {
  let y = meanY;
  for (let j = 0; j < k; j++) y += beta[j] * (x[j] - meanX[j]);
  return y;
};
const residuals = X.map((xi, i) => Y[i] - getTrend(xi));

const predict = (x) => {
  let num = 0;
  let den = 0;
  for (let i = 0; i < X.length; i++) {
    let dSq = 0;
    for (let j = 0; j < k; j++) dSq += Math.pow(x[j] - X[i][j], 2);
    if (dSq < 1e-10) return Y[i];
    const w = 1 / (dSq + 1e-8);
    num += w * residuals[i];
    den += w;
  }
  return getTrend(x) + (den > 0 ? (num / den) : 0);
};

console.log(predict([20, 0.8]));
console.log(predict([30, 1.9]));
