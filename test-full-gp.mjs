import jstat from 'jstat';
const jStat = (jstat).default || jstat;

const X = [[0], [0.2], [0.4], [0.6], [0.8], [1]];
const y = [[0.1], [0.3], [0.7], [0.6], [0.2], [0]];
const N = X.length;
const k = 1;

const meanY = jStat.mean(y.map(v => v[0]));
const stdY = jStat.stdev(y.map(v => v[0]), true) || 1e-6;
const y_norm = y.map(v => [(v[0] - meanY) / stdY]);

function getMatern52(sigma_f, l, sigma_n) {
  return function(xi, xj, is_same = false) {
    let r2 = 0;
    for (let d = 0; d < k; d++) r2 += Math.pow(xi[d] - xj[d], 2);
    const r = Math.sqrt(r2);
    const val = (1 + (Math.sqrt(5) * r) / l + (5 * r2) / (3 * l * l)) * Math.exp(-(Math.sqrt(5) * r) / l);
    return sigma_f * sigma_f * val + (is_same ? sigma_n * sigma_n : 0);
  };
}

const l_candidates = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
const sigma_n_candidates = [0.001, 0.01, 0.1];
const sigma_f = 1.0;

let best_l = 0.5;
let best_sn = 0.01;
let best_lml = -Infinity;

for (let l of l_candidates) {
  for (let sn of sigma_n_candidates) {
    const kernel = getMatern52(sigma_f, l, sn);
    const K_XX = [];
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++) row.push(kernel(X[i], X[j], i === j));
      K_XX.push(row);
    }
    
    try {
      const K_inv = jStat.inv(K_XX);
      const K_det = jStat.det(K_XX);
      if (K_det <= 0) continue;
      
      const term1_mat = jStat.multiply(jStat.multiply(jStat.transpose(y_norm), K_inv), y_norm);
      const term1 = typeof term1_mat === 'number' ? term1_mat : term1_mat[0][0];
      const lml = -0.5 * term1 - 0.5 * Math.log(K_det) - (N / 2) * Math.log(2 * Math.PI);
      
      if (lml > best_lml) {
        best_lml = lml;
        best_l = l;
        best_sn = sn;
      }
    } catch (e) {
      // Ignore
    }
  }
}

console.log("Best params:", { l: best_l, sigma_n: best_sn, lml: best_lml });

const kernel = getMatern52(sigma_f, best_l, best_sn);
const K_XX = [];
for (let i = 0; i < N; i++) {
  const row = [];
  for (let j = 0; j < N; j++) row.push(kernel(X[i], X[j], i === j));
  K_XX.push(row);
}
const K_inv = jStat.inv(K_XX);
const alpha = jStat.multiply(K_inv, y_norm);

function predict(x) {
  const k_star = [[]];
  for (let i = 0; i < N; i++) k_star[0].push(kernel(x, X[i], false));
  const mu_norm_res = jStat.multiply(k_star, alpha);
  const mu_norm = typeof mu_norm_res === 'number' ? mu_norm_res : mu_norm_res[0][0];
  const k_star_T = jStat.transpose(k_star);
  const v_res = jStat.multiply(jStat.multiply(k_star, K_inv), k_star_T);
  const v = typeof v_res === 'number' ? v_res : v_res[0][0];
  const var_norm = Math.max(0, kernel(x, x, false) - v);
  
  return {
    y: mu_norm * stdY + meanY,
    uncertainty: Math.sqrt(var_norm) * stdY
  };
}

console.log("Predict 0.4", predict([0.4]));
console.log("Predict 0.5", predict([0.5]));

