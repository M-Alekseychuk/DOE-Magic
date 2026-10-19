import fs from 'fs';

let content = fs.readFileSync('src/components/ProjectOptimization.tsx', 'utf8');

// 1. Optimize predict
const oldPredict = `    predict = (x: number[]) => {
      const k_star = [[] as number[]];
      for (let i = 0; i < N_runs; i++) k_star[0].push(kernel(x, X[i], false));
      const mu_norm_res = jStat.multiply(k_star, alpha);
      const mu_norm = typeof mu_norm_res === 'number' ? mu_norm_res : mu_norm_res[0][0];
      const k_star_T = jStat.transpose(k_star);
      const v_res = jStat.multiply(jStat.multiply(k_star, best_K_inv), k_star_T);
      const v = typeof v_res === 'number' ? v_res : v_res[0][0];
      const var_norm = Math.max(0, kernel(x, x, false) - v);
      return { y: mu_norm * stdY + meanY, uncertainty: Math.sqrt(var_norm) * stdY };
    };`;

const newPredict = `    predict = (x: number[]) => {
      const k_star = new Float64Array(N_runs);
      for (let i = 0; i < N_runs; i++) k_star[i] = kernel(x, X[i], false);
      let mu_norm = 0;
      for (let i = 0; i < N_runs; i++) mu_norm += k_star[i] * alpha[i][0];
      let v = 0;
      for (let i = 0; i < N_runs; i++) {
        let sum = 0;
        for (let j = 0; j < N_runs; j++) sum += k_star[j] * best_K_inv![j][i];
        v += sum * k_star[i];
      }
      const var_norm = Math.max(0, kernel(x, x, false) - v);
      return { y: mu_norm * stdY + meanY, uncertainty: Math.sqrt(var_norm) * stdY };
    };`;

content = content.replace(oldPredict, newPredict);

// 2. Reduce N
const oldN = `const N = 10000;`;
const newN = `const N = 2000;`;
content = content.replace(oldN, newN);

// 3. Improve diversity
const oldDiversity = `  // Pick top N diverse candidates
  const bestCandidates: typeof candidates = [];
  for (const c of candidates) {
    if (bestCandidates.length >= numSuggestions) break;
    let tooClose = false;
    for (const b of bestCandidates) {
      let dSq = 0;
      for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - b.x[j], 2);
      if (Math.sqrt(dSq) < 0.15) { tooClose = true; break; } // Diversity constraint
    }
    // Also avoid being too close to existing runs
    if (!tooClose) {
      for (const r of X) {
        let dSq = 0;
        for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - r[j], 2);
        if (Math.sqrt(dSq) < 0.05) { tooClose = true; break; }
      }
    }
    
    if (!tooClose) bestCandidates.push(c);
  }
  
  if (bestCandidates.length < numSuggestions) {
     for (const c of candidates) {
         if (bestCandidates.length >= numSuggestions) break;
         if (!bestCandidates.includes(c)) bestCandidates.push(c);
     }
  }`;

const newDiversity = `  // Pick top N diverse candidates
  const bestCandidates: typeof candidates = [];
  const distanceThresholds = [0.35, 0.25, 0.15, 0.0];
  
  for (const threshold of distanceThresholds) {
    if (bestCandidates.length >= numSuggestions) break;
    for (const c of candidates) {
      if (bestCandidates.length >= numSuggestions) break;
      if (bestCandidates.includes(c)) continue;
      
      let tooClose = false;
      for (const b of bestCandidates) {
        let dSq = 0;
        for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - b.x[j], 2);
        if (Math.sqrt(dSq) < threshold) { tooClose = true; break; }
      }
      if (!tooClose) {
        for (const r of X) {
          let dSq = 0;
          for (let j = 0; j < k; j++) dSq += Math.pow(c.x[j] - r[j], 2);
          if (Math.sqrt(dSq) < (threshold > 0 ? threshold * 0.5 : 0)) { tooClose = true; break; }
        }
      }
      if (!tooClose) bestCandidates.push(c);
    }
  }`;
content = content.replace(oldDiversity, newDiversity);

fs.writeFileSync('src/components/ProjectOptimization.tsx', content);
console.log('done 1-3');
