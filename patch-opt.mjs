import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

const targetStr = `
  // Linear Regression (Main Effects) + IDW Residuals to allow extrapolation
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

  const getTrend = (x: number[]) => {
    let y = meanY;
    for (let j = 0; j < k; j++) y += beta[j] * (x[j] - meanX[j]);
    return y;
  };

  const residuals = X.map((xi, i) => Y[i] - getTrend(xi));

  // Predict function (simulated surrogate model using IDW logic for frontend execution)
  const predict = (x: number[]) => {
    let num = 0;
    let den = 0;
    let minD = Infinity;

    for (let i = 0; i < X.length; i++) {
      let dSq = 0;
      for (let j = 0; j < k; j++) {
        dSq += Math.pow(x[j] - X[i][j], 2);
      }
      const d = Math.sqrt(dSq);
      if (d < minD) {
        minD = d;
      }
      if (d < 1e-6) {
        return { y: Y[i], uncertainty: 0 };
      }
      const w = 1 / (dSq + 1e-8);
      num += w * residuals[i];
      den += w;
    }
    
    const trend = getTrend(x);
    let y_pred = trend + (den > 0 ? (num / den) : 0);
    let uncertainty = minD;
    
    // Add some variation based on selected model to simulate different behaviors
    if (surrogateModel === 'gp') {
      uncertainty = Math.min(1.0, minD * 1.5);
    } else if (surrogateModel === 'rf') {
      y_pred += (Math.random() - 0.5) * 0.05 * minD * Math.abs(y_pred);
    }
    
    return { y: y_pred, uncertainty };
  };

  // Sample points
  const N = 10000;
  const candidates: { x: number[], y_pred: number, uncertainty: number, score: number, ucb: number }[] = [];

  for (let i = 0; i < N; i++) {
    const x = project.factors.map(() => Math.random());
    const { y, uncertainty } = predict(x);
    
    let score = 0;
    if (activeResponse.goal === 'maximize') score = y;
    else if (activeResponse.goal === 'minimize') score = -y;
    else {
      const target = activeResponse.targetValue ?? 0;
      score = -Math.abs(y - target);
    }
    
    candidates.push({ x, y_pred: y, uncertainty, score, ucb: 0 });
  }

  // Normalize score and uncertainty to [0, 1]
  const minScore = Math.min(...candidates.map(c => c.score));
  const maxScore = Math.max(...candidates.map(c => c.score));
  const minUnc = Math.min(...candidates.map(c => c.uncertainty));
  const maxUnc = Math.max(...candidates.map(c => c.uncertainty));

  const kappa = 2.0; // exploration weight

  candidates.forEach(c => {
    const normScore = maxScore > minScore ? (c.score - minScore) / (maxScore - minScore) : 0.5;
    const normUnc = maxUnc > minUnc ? (c.uncertainty - minUnc) / (maxUnc - minUnc) : 0.5;
    c.ucb = normScore + kappa * normUnc;
  });

  // Sort by UCB descending
  candidates.sort((a, b) => b.ucb - a.ucb);`.trim();

const replaceStr = `
  // GP Hyperparameter Optimization and Training
  const N_runs = X.length;
  
  let predict: (x: number[]) => { y: number, uncertainty: number };
  let modelInfo = '';
  
  const meanY = jStat.mean(Y);
  const stdY = jStat.stdev(Y, true) || 1e-6;
  const y_norm = Y.map(y => [(y - meanY) / stdY]);

  // Matern 5/2 Kernel
  const getMatern52 = (sigma_f: number, l: number, sigma_n: number) => (xi: number[], xj: number[], is_same = false) => {
    let r2 = 0;
    for (let d = 0; d < k; d++) r2 += Math.pow(xi[d] - xj[d], 2);
    const r = Math.sqrt(r2);
    const val = (1 + (Math.sqrt(5) * r) / l + (5 * r2) / (3 * l * l)) * Math.exp(-(Math.sqrt(5) * r) / l);
    return sigma_f * sigma_f * val + (is_same ? sigma_n * sigma_n : 0);
  };

  const l_candidates = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
  const sigma_n_candidates = [0.001, 0.01, 0.1];
  const sigma_f = 1.0;

  let best_l = 0.5;
  let best_sn = 0.01;
  let best_lml = -Infinity;
  let best_K_inv: number[][] | null = null;
  let best_K_XX: number[][] | null = null;

  for (let l of l_candidates) {
    for (let sn of sigma_n_candidates) {
      const kernel = getMatern52(sigma_f, l, sn);
      const K_XX: number[][] = [];
      for (let i = 0; i < N_runs; i++) {
        const row: number[] = [];
        for (let j = 0; j < N_runs; j++) row.push(kernel(X[i], X[j], i === j));
        K_XX.push(row);
      }
      try {
        const K_inv = jStat.inv(K_XX);
        const K_det = jStat.det(K_XX);
        if (K_det <= 0) continue;
        const term1_mat = jStat.multiply(jStat.multiply(jStat.transpose(y_norm), K_inv), y_norm);
        const term1 = typeof term1_mat === 'number' ? term1_mat : term1_mat[0][0];
        const lml = -0.5 * term1 - 0.5 * Math.log(K_det) - (N_runs / 2) * Math.log(2 * Math.PI);
        if (lml > best_lml) {
          best_lml = lml; best_l = l; best_sn = sn; best_K_inv = K_inv; best_K_XX = K_XX;
        }
      } catch (e) { /* ignore */ }
    }
  }

  if (best_K_inv && best_K_XX) {
    const alpha = jStat.multiply(best_K_inv, y_norm);
    const kernel = getMatern52(sigma_f, best_l, best_sn);
    predict = (x: number[]) => {
      const k_star = [[] as number[]];
      for (let i = 0; i < N_runs; i++) k_star[0].push(kernel(x, X[i], false));
      const mu_norm_res = jStat.multiply(k_star, alpha);
      const mu_norm = typeof mu_norm_res === 'number' ? mu_norm_res : mu_norm_res[0][0];
      const k_star_T = jStat.transpose(k_star);
      const v_res = jStat.multiply(jStat.multiply(k_star, best_K_inv), k_star_T);
      const v = typeof v_res === 'number' ? v_res : v_res[0][0];
      const var_norm = Math.max(0, kernel(x, x, false) - v);
      return { y: mu_norm * stdY + meanY, uncertainty: Math.sqrt(var_norm) * stdY };
    };
    modelInfo = \`**Gaussian Process (Matern 5/2)** optimized hyperparams: length-scale \${best_l.toFixed(2)}, noise variance \${best_sn.toFixed(3)}. Provides robust uncertainty estimates and Expected Improvement (EI).\`;
  } else {
    // Fallback to simple mean if GP fails completely
    predict = (x: number[]) => ({ y: meanY, uncertainty: stdY });
    modelInfo = \`Failed to fit GP. Falling back to simple mean.\`;
  }

  // Calculate best observed objective for EI
  let f_best = -Infinity;
  for (let i = 0; i < N_runs; i++) {
    const y = Y[i];
    let score = 0;
    if (activeResponse.goal === 'maximize') score = y;
    else if (activeResponse.goal === 'minimize') score = -y;
    else score = -Math.abs(y - (activeResponse.targetValue ?? 0));
    if (score > f_best) f_best = score;
  }

  // Sample points
  const N = 10000;
  const candidates: { x: number[], y_pred: number, uncertainty: number, score: number, ei: number }[] = [];

  for (let i = 0; i < N; i++) {
    const x = project.factors.map(() => Math.random());
    const { y, uncertainty } = predict(x);
    
    let mu_obj = 0;
    if (activeResponse.goal === 'maximize') mu_obj = y;
    else if (activeResponse.goal === 'minimize') mu_obj = -y;
    else mu_obj = -Math.abs(y - (activeResponse.targetValue ?? 0));

    const sigma_obj = uncertainty;
    const xi = 0.01 * stdY;
    
    let ei = 0;
    if (sigma_obj > 1e-6) {
      const Z = (mu_obj - f_best - xi) / sigma_obj;
      ei = (mu_obj - f_best - xi) * jStat.normal.cdf(Z, 0, 1) + sigma_obj * jStat.normal.pdf(Z, 0, 1);
    } else {
      ei = mu_obj > f_best + xi ? (mu_obj - f_best - xi) : 0;
    }
    
    candidates.push({ x, y_pred: y, uncertainty, score: mu_obj, ei });
  }

  // Sort by EI descending
  candidates.sort((a, b) => b.ei - a.ei);`.trim();

if (!content.includes(targetStr)) {
  console.log("Target not found exactly");
} else {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
  console.log("Replaced successfully!");
}
