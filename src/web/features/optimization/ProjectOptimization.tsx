import React, { useState, useMemo } from 'react';
import { Project } from '../../../core/types';
import { Cpu, Sparkles, Loader2, Target, TrendingUp, Compass, Sliders, Info, ArrowUpRight, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../i18n/LanguageContext';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
}

export interface OptimizationOptions {
  numSuggestions: number;
  targetResponseId: string;
  goal: 'maximize' | 'minimize' | 'target';
  targetValue: number;
  extrapolationMargin: number; // 0.0 = within bounds, 0.15 = 15%, 0.30 = 30%, etc.
  surrogateType: 'trend_gp' | 'stationary_gp';
}

// Fast O(N^3) Cholesky decomposition: A = L * L^T
function cholesky(A: number[][], jitter: number = 1e-6): Float64Array[] | null {
  const n = A.length;
  const L: Float64Array[] = Array(n).fill(0).map(() => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const diag = A[i][i] + jitter - sum;
        if (diag <= 0) return null;
        L[i][j] = Math.sqrt(diag);
      } else {
        if (L[j][j] === 0) return null;
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

// Solve L * L^T * alpha = y via forward and back substitution in O(N^2)
function solveCholesky(L: Float64Array[], y: number[]): { alpha: Float64Array; v: Float64Array } {
  const n = L.length;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i][j] * v[j];
    v[i] = (y[i] - sum) / L[i][i];
  }
  const alpha = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += L[j][i] * alpha[j];
    alpha[i] = (v[i] - sum) / L[i][i];
  }
  return { alpha, v };
}

// Solve L * w = k_star for prediction variance in O(N^2)
function solveL(L: Float64Array[], k_star: Float64Array): Float64Array {
  const n = L.length;
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i][j] * w[j];
    w[i] = (k_star[i] - sum) / L[i][i];
  }
  return w;
}

function normPdf(z: number): number {
  return 0.3989422804014327 * Math.exp(-0.5 * z * z);
}

function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

function runLocalOptimization(
  project: Project, 
  options: OptimizationOptions
): { md: string, candidates: Record<string, string | number>[] } {
  const { numSuggestions, targetResponseId, goal, targetValue, extrapolationMargin, surrogateType } = options;
  const activeResponse = project.responses.find(r => r.id === targetResponseId) || project.responses[0];
  if (!activeResponse) return { md: "No responses defined to optimize.", candidates: [] };

  const validRuns = project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && !isNaN(Number(r.responses[activeResponse.id])));
  if (validRuns.length === 0) return { md: "No valid run data available.", candidates: [] };
  if (validRuns.length < 2) {
    return {
      md: `### Insufficient Data for Bayesian Optimization\n\nAt least **2 completed runs** with valid measurements for response **${activeResponse.name}** are required to train the Gaussian Process surrogate model. Currently, only ${validRuns.length} valid run(s) are recorded.`,
      candidates: []
    };
  }

  const k = project.factors.length;
  if (k === 0) return { md: "No factors defined.", candidates: [] };

  // Normalize run data:
  // Categorical factors: store integer level index (0, 1, 2...)
  // Continuous factors: normalize to [0, 1] relative to [f.min, f.max]
  const X: number[][] = validRuns.map(run => {
    return project.factors.map(f => {
      if (f.type === 'categorical') {
        const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        const raw = run.factors[f.id];
        let idx = levels.indexOf(String(raw));
        if (idx === -1) {
          const num = Number(raw);
          idx = !isNaN(num) && num >= 0 && num < levels.length ? num : 0;
        }
        return idx;
      }
      const val = Number(run.factors[f.id]);
      if (f.max === f.min) return 0.5;
      return (val - f.min) / (f.max - f.min);
    });
  });

  const Y: number[] = validRuns.map(run => Number(run.responses[activeResponse.id]));
  const N_runs = X.length;

  const meanY = Y.reduce((a, b) => a + b, 0) / N_runs;
  const varianceY = Y.reduce((a, b) => a + (b - meanY) ** 2, 0) / Math.max(1, N_runs - 1);
  const stdY = Math.sqrt(varianceY) || 1e-6;

  // Fit regularized linear trend (Response Surface Drift / First-Order OLS)
  // X_mat: [1, x_0, x_1, ..., x_{k-1}]
  const p_dim = k + 1;
  const X_mat: number[][] = [];
  for (let i = 0; i < N_runs; i++) {
    const row = [1.0];
    for (let d = 0; d < k; d++) {
      const f = project.factors[d];
      if (f.type === 'categorical') {
        const numLvls = (f.levels && f.levels.length > 1) ? f.levels.length : 2;
        row.push(X[i][d] / (numLvls - 1));
      } else {
        row.push(X[i][d]);
      }
    }
    X_mat.push(row);
  }

  // Normal equations: (X^T X + lambda I) beta = X^T Y
  const lambdaRidge = 1e-4;
  const ATA: number[][] = Array(p_dim).fill(0).map(() => Array(p_dim).fill(0));
  const ATY: number[] = Array(p_dim).fill(0);

  for (let i = 0; i < p_dim; i++) {
    for (let j = 0; j < p_dim; j++) {
      let sum = 0;
      for (let r = 0; r < N_runs; r++) sum += X_mat[r][i] * X_mat[r][j];
      ATA[i][j] = sum + (i === j ? lambdaRidge : 0);
    }
    let sumY = 0;
    for (let r = 0; r < N_runs; r++) sumY += X_mat[r][i] * Y[r];
    ATY[i] = sumY;
  }

  let beta: number[] = Array(p_dim).fill(0);
  const L_ATA = cholesky(ATA);
  if (L_ATA) {
    const sol = solveCholesky(L_ATA, ATY);
    beta = Array.from(sol.alpha);
  } else {
    beta[0] = meanY;
  }

  const getTrend = (x_norm: number[]): number => {
    let t = beta[0];
    for (let d = 0; d < k; d++) {
      const f = project.factors[d];
      let val = x_norm[d];
      if (f.type === 'categorical') {
        const numLvls = (f.levels && f.levels.length > 1) ? f.levels.length : 2;
        val = x_norm[d] / (numLvls - 1);
      }
      t += beta[d + 1] * val;
    }
    return t;
  };

  // Calculate residuals and trend R^2
  const residuals = Y.map((y, i) => y - getTrend(X[i]));
  const ss_tot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const ss_res = residuals.reduce((sum, r) => sum + r ** 2, 0);
  const trendR2 = ss_tot > 1e-6 ? Math.max(0, Math.min(1, 1 - (ss_res / ss_tot))) : 0;
  
  const var_res = residuals.reduce((sum, r) => sum + r ** 2, 0) / Math.max(1, N_runs - 1);
  const std_res = Math.sqrt(var_res) || 1e-5;

  // Select target for GP training
  const useTrendAwareGP = surrogateType === 'trend_gp';
  const trainY = useTrendAwareGP 
    ? residuals.map(r => r / std_res) 
    : Y.map(y => (y - meanY) / stdY);

  // Standard mixed-variable Gower / Hamming distance
  const getDistanceSq = (xi: number[], xj: number[]) => {
    let r2 = 0;
    for (let d = 0; d < k; d++) {
      const f = project.factors[d];
      if (f.type === 'categorical') {
        r2 += (xi[d] === xj[d]) ? 0 : 1.0;
      } else {
        r2 += Math.pow(xi[d] - xj[d], 2);
      }
    }
    return r2;
  };

  // Matern 5/2 Kernel
  const getMatern52 = (sigma_f: number, l: number, sigma_n: number) => (xi: number[], xj: number[], is_same = false) => {
    const r2 = getDistanceSq(xi, xj);
    const r = Math.sqrt(r2);
    const val = (1 + (Math.sqrt(5) * r) / l + (5 * r2) / (3 * l * l)) * Math.exp(-(Math.sqrt(5) * r) / l);
    return sigma_f * sigma_f * val + (is_same ? (sigma_n * sigma_n + 1e-5) : 0);
  };

  const l_candidates = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
  const sigma_n_candidates = [0.001, 0.01, 0.1];
  const sigma_f = 1.0;

  let best_l = 0.5;
  let best_sn = 0.01;
  let best_lml = -Infinity;
  let best_L: Float64Array[] | null = null;
  let best_alpha: Float64Array | null = null;

  for (const l of l_candidates) {
    for (const sn of sigma_n_candidates) {
      const kernel = getMatern52(sigma_f, l, sn);
      const K_XX: number[][] = [];
      for (let i = 0; i < N_runs; i++) {
        const row: number[] = [];
        for (let j = 0; j < N_runs; j++) row.push(kernel(X[i], X[j], i === j));
        K_XX.push(row);
      }
      try {
        const L = cholesky(K_XX);
        if (!L) continue;
        const { alpha, v } = solveCholesky(L, trainY);
        let logDet = 0;
        for (let i = 0; i < N_runs; i++) logDet += 2 * Math.log(L[i][i]);
        let quad = 0;
        for (let i = 0; i < N_runs; i++) quad += v[i] * v[i];
        const lml = -0.5 * quad - 0.5 * logDet - 0.5 * N_runs * Math.log(2 * Math.PI);
        if (isFinite(lml) && lml > best_lml) {
          best_lml = lml;
          best_l = l;
          best_sn = sn;
          best_L = L;
          best_alpha = alpha;
        }
      } catch (e) { /* ignore */ }
    }
  }

  let predict: (x: number[]) => { y: number, uncertainty: number };
  let modelInfo = '';

  if (best_L && best_alpha) {
    const kernel = getMatern52(sigma_f, best_l, best_sn);
    predict = (x: number[]) => {
      const k_star = new Float64Array(N_runs);
      for (let i = 0; i < N_runs; i++) k_star[i] = kernel(x, X[i], false);
      let mu_norm = 0;
      for (let i = 0; i < N_runs; i++) mu_norm += k_star[i] * best_alpha![i];
      const w = solveL(best_L!, k_star);
      let w_sq = 0;
      for (let i = 0; i < N_runs; i++) w_sq += w[i] * w[i];
      const var_norm = Math.max(0, kernel(x, x, false) - w_sq);

      if (useTrendAwareGP) {
        // Universal Kriging / Semi-parametric GP:
        // As you extrapolate outside data, the GP residual mu_norm decays to 0,
        // and the prediction gracefully follows the linear response surface trend.
        const y_pred = getTrend(x) + mu_norm * std_res;
        const uncertainty = Math.sqrt(var_norm) * Math.max(std_res, stdY * 0.25);
        return { y: y_pred, uncertainty };
      } else {
        // Standard stationary zero-mean GP (reverts to meanY outside data)
        const y_pred = mu_norm * stdY + meanY;
        const uncertainty = Math.sqrt(var_norm) * stdY;
        return { y: y_pred, uncertainty };
      }
    };

    if (useTrendAwareGP) {
      modelInfo = `**Trend-Aware Gaussian Process (Universal Kriging / Matern 5/2)**\n- **Response Surface Trend:** Linear drift fitted (R² = ${(trendR2 * 100).toFixed(1)}%). Projects positive/negative trajectories outside the tested box.\n- **GP Hyperparameters:** Length-scale *l* = ${best_l.toFixed(2)}, noise *σ_n* = ${best_sn.toFixed(3)}.\n- **Extrapolation Behavior:** Predicts along the path of steepest ascent/descent while expanding uncertainty intervals with distance.`;
    } else {
      modelInfo = `**Stationary Gaussian Process (Matern 5/2, Constant Prior Mean)**\n- Length-scale *l* = ${best_l.toFixed(2)}, noise *σ_n* = ${best_sn.toFixed(3)}.\n- Reverts to historical average (${meanY.toFixed(1)}) far outside the tested bounds.`;
    }
  } else {
    predict = (x: number[]) => ({ y: getTrend(x), uncertainty: stdY });
    modelInfo = `Linear response surface model (R² = ${(trendR2 * 100).toFixed(1)}%).`;
  }

  // Calculate best observed objective
  let f_best = -Infinity;
  for (let i = 0; i < N_runs; i++) {
    const y = Y[i];
    let score = 0;
    if (goal === 'maximize') score = y;
    else if (goal === 'minimize') score = -y;
    else score = -Math.abs(y - targetValue);
    if (score > f_best) f_best = score;
  }

  // Steepest Ascent Gradient Vector for continuous factors
  const gradientDir: { factor: typeof project.factors[0], slope: number, stepSign: number, label: string }[] = [];
  let gradNormSq = 0;
  project.factors.forEach((f, idx) => {
    if (f.type !== 'categorical') {
      const slope = beta[idx + 1] || 0;
      gradNormSq += slope * slope;
      const stepSign = goal === 'minimize' ? -Math.sign(slope) : Math.sign(slope);
      gradientDir.push({
        factor: f,
        slope,
        stepSign,
        label: stepSign > 0 ? 'Increase (+)' : (stepSign < 0 ? 'Decrease (-)' : 'Neutral')
      });
    }
  });

  // Candidate generation with Extrapolation Margin
  // If extrapolationMargin = 0.3, search space expands to [-0.3, 1.3]
  const margin = Math.max(0, extrapolationMargin);
  const N_candidates = 3500;
  const candidates: { 
    x: number[]; 
    y_pred: number; 
    uncertainty: number; 
    score: number; 
    ei: number;
    maxExtrapPct: number;
  }[] = [];

  // Helper to clamp physical values if non-negative
  const normalizeAndClamp = (f: typeof project.factors[0], rawNorm: number) => {
    if (f.type === 'categorical') {
      const levels = (f.levels && f.levels.length > 0) ? f.levels : ['Level 1', 'Level 2'];
      return Math.floor(Math.random() * levels.length);
    }
    const realVal = f.min + rawNorm * (f.max - f.min);
    // If factor min is non-negative (e.g. concentration, temperature K, time), prevent negative values
    if (f.min >= 0 && realVal < 0) {
      return 0;
    }
    return rawNorm;
  };

  // 1. Uniform Monte Carlo sampling in expanded box [-margin, 1 + margin]
  for (let i = 0; i < N_candidates; i++) {
    const x = project.factors.map(f => {
      if (f.type === 'categorical') {
        const levels = (f.levels && f.levels.length > 0) ? f.levels : ['Level 1', 'Level 2'];
        return Math.floor(Math.random() * levels.length);
      }
      // Sample uniformly in [-margin, 1 + margin]
      const rawNorm = -margin + Math.random() * (1 + 2 * margin);
      return normalizeAndClamp(f, rawNorm);
    });

    const { y, uncertainty } = predict(x);

    // Calculate max extrapolation percentage across factors
    let maxExtrapPct = 0;
    project.factors.forEach((f, idx) => {
      if (f.type !== 'categorical') {
        if (x[idx] > 1.001) maxExtrapPct = Math.max(maxExtrapPct, (x[idx] - 1.0) * 100);
        else if (x[idx] < -0.001) maxExtrapPct = Math.max(maxExtrapPct, (-x[idx]) * 100);
      }
    });

    let score = 0;
    let ei = 0;
    const sigma = Math.max(1e-5, uncertainty);

    if (goal === 'target') {
      // Closeness to target value with uncertainty penalty
      const diff = Math.abs(y - targetValue);
      score = -diff;
      // Probability mass in a ±1.0 (or ±2%) window around target
      const halfWindow = Math.max(0.5, Math.abs(targetValue) * 0.02);
      const z1 = (targetValue - halfWindow - y) / sigma;
      const z2 = (targetValue + halfWindow - y) / sigma;
      ei = Math.max(0, normCdf(z2) - normCdf(z1));
    } else if (goal === 'maximize') {
      score = y;
      const xi = 0.01 * stdY;
      const Z = (y - f_best - xi) / sigma;
      ei = (y - f_best - xi) * normCdf(Z) + sigma * normPdf(Z);
    } else {
      score = -y;
      const xi = 0.01 * stdY;
      const Z = (f_best - y - xi) / sigma;
      ei = (f_best - y - xi) * normCdf(Z) + sigma * normPdf(Z);
    }

    candidates.push({ x, y_pred: y, uncertainty, score, ei, maxExtrapPct });
  }

  // 2. Targeted Steepest Ascent Trajectory Sampling
  // Explicitly inject candidates along the steepest gradient line
  if (margin > 0 && gradNormSq > 1e-6) {
    const gradNorm = Math.sqrt(gradNormSq);
    // Find highest performing observation as starting point
    let bestObsIdx = 0;
    let bestVal = goal === 'minimize' ? Infinity : -Infinity;
    Y.forEach((val, idx) => {
      if ((goal === 'minimize' && val < bestVal) || (goal !== 'minimize' && val > bestVal)) {
        bestVal = val;
        bestObsIdx = idx;
      }
    });
    const baseCoords = X[bestObsIdx];

    const stepFractions = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 1.0];
    stepFractions.forEach(frac => {
      if (frac * margin > 0) {
        const x_ascent = project.factors.map((f, d) => {
          if (f.type === 'categorical') return baseCoords[d];
          const slope = beta[d + 1] || 0;
          const direction = goal === 'minimize' ? -slope : slope;
          const step = (direction / gradNorm) * (frac * margin * 2.0);
          const rawNorm = baseCoords[d] + step;
          return normalizeAndClamp(f, rawNorm);
        });

        const { y, uncertainty } = predict(x_ascent);
        let maxExtrapPct = 0;
        project.factors.forEach((f, idx) => {
          if (f.type !== 'categorical') {
            if (x_ascent[idx] > 1.001) maxExtrapPct = Math.max(maxExtrapPct, (x_ascent[idx] - 1.0) * 100);
            else if (x_ascent[idx] < -0.001) maxExtrapPct = Math.max(maxExtrapPct, (-x_ascent[idx]) * 100);
          }
        });

        let score = 0;
        let ei = 0;
        const sigma = Math.max(1e-5, uncertainty);

        if (goal === 'target') {
          score = -Math.abs(y - targetValue);
          const halfWindow = Math.max(0.5, Math.abs(targetValue) * 0.02);
          const z1 = (targetValue - halfWindow - y) / sigma;
          const z2 = (targetValue + halfWindow - y) / sigma;
          ei = Math.max(0, normCdf(z2) - normCdf(z1));
        } else if (goal === 'maximize') {
          score = y;
          const xi = 0.01 * stdY;
          const Z = (y - f_best - xi) / sigma;
          ei = (y - f_best - xi) * normCdf(Z) + sigma * normPdf(Z);
        } else {
          score = -y;
          const xi = 0.01 * stdY;
          const Z = (f_best - y - xi) / sigma;
          ei = (f_best - y - xi) * normCdf(Z) + sigma * normPdf(Z);
        }

        candidates.push({ x: x_ascent, y_pred: y, uncertainty, score, ei, maxExtrapPct });
      }
    });
  }

  // Sort candidates
  if (goal === 'target') {
    // For target goal, order primarily by closeness to target (|y - target|), with secondary tie-break on confidence
    candidates.sort((a, b) => {
      const diffA = Math.abs(a.y_pred - targetValue);
      const diffB = Math.abs(b.y_pred - targetValue);
      if (Math.abs(diffA - diffB) > 0.1) return diffA - diffB;
      return b.ei - a.ei;
    });
  } else {
    // For maximize or minimize, sort by Expected Improvement descending
    candidates.sort((a, b) => b.ei - a.ei);
  }

  // Pick diverse top candidates
  const bestCandidates: typeof candidates = [];
  const distanceThresholds = [0.35, 0.25, 0.15, 0.05, 0.0];

  for (const threshold of distanceThresholds) {
    if (bestCandidates.length >= numSuggestions) break;
    for (const c of candidates) {
      if (bestCandidates.length >= numSuggestions) break;
      if (bestCandidates.includes(c)) continue;

      let tooClose = false;
      for (const b of bestCandidates) {
        if (Math.sqrt(getDistanceSq(c.x, b.x)) < threshold) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose && threshold > 0.05) {
        for (const r of X) {
          if (Math.sqrt(getDistanceSq(c.x, r)) < threshold * 0.4) {
            tooClose = true;
            break;
          }
        }
      }
      if (!tooClose) bestCandidates.push(c);
    }
  }

  // Format Markdown output
  let md = `### Bayesian Parameter Optimization Results\n\n`;
  md += `Analysis completed for response **${activeResponse.name}**\n\n`;
  md += `| Parameter | Setting |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Optimization Goal** | **${goal === 'target' ? `Target Value (${targetValue} ${activeResponse.unit || ''})` : (goal === 'maximize' ? 'Maximize Response' : 'Minimize Response')}** |\n`;
  md += `| **Search Domain** | **${margin === 0 ? 'Inside Tested Bounds (0% Extrapolation)' : `Extended by ±${Math.round(margin * 100)}% (Steepest Ascent Enabled)`}** |\n`;
  md += `| **Current Best Observed** | **${Math.max(...Y).toFixed(2)} ${activeResponse.unit || ''}** (Historical Mean: ${meanY.toFixed(2)}) |\n\n`;

  md += `#### Surrogate Model Architecture\n`;
  md += `${modelInfo}\n\n`;

  // Method of Steepest Ascent / Extrapolation Guide
  if (margin > 0 && gradientDir.length > 0) {
    md += `#### Method of Steepest Ascent (Extrapolation Direction)\n`;
    md += `To drive **${activeResponse.name}** ${goal === 'target' ? `towards the **${targetValue}** target` : 'beyond the current observed maximum'}, the response surface gradient indicates the following factor stepping directions:\n\n`;
    gradientDir.forEach(g => {
      const stepMagnitude = Math.abs(g.slope);
      md += `- **${g.factor.name}:** **${g.label}** (Sensitivity: ${stepMagnitude.toFixed(2)})\n`;
    });
    md += `\n`;
  }

  md += `#### Recommended Next Runs\n`;
  if (goal === 'target') {
    md += `The optimizer has identified the following factor conditions whose predicted response matches your target of **${targetValue} ${activeResponse.unit || ''}**:\n\n`;
  } else {
    md += `The optimizer suggests the following conditions balancing exploration (learning uncertain regions) and exploitation (maximizing performance) using **Expected Improvement (EI)**:\n\n`;
  }

  const returnedCandidates: Record<string, string | number>[] = [];

  bestCandidates.forEach((c, idx) => {
    const isExtrapolated = c.maxExtrapPct > 1.0;
    const extrapTag = isExtrapolated 
      ? ` 🚀 *(Extrapolated +${Math.round(c.maxExtrapPct)}% beyond previous bounds)*`
      : ` *(Within Tested Design Space)*`;

    const pi_low = (c.y_pred - 1.96 * c.uncertainty).toFixed(2);
    const pi_high = (c.y_pred + 1.96 * c.uncertainty).toFixed(2);

    md += `**Suggestion #${idx + 1}**${extrapTag}\n`;
    md += `- **Predicted ${activeResponse.name}:** **~${c.y_pred.toFixed(2)} ${activeResponse.unit || ''}** (95% Confidence Interval: [${pi_low}, ${pi_high}])\n`;
    md += `- **Factor Settings:**\n`;

    const candidateFactors: Record<string, string | number> = {};
    project.factors.forEach((f, fIdx) => {
      if (f.type === 'categorical') {
        const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        const chosenLevel = levels[c.x[fIdx]] ?? levels[0];
        candidateFactors[f.id] = chosenLevel;
        md += `  - ${f.name} (Categorical): **${chosenLevel}**\n`;
      } else {
        const realVal = f.min + c.x[fIdx] * (f.max - f.min);
        candidateFactors[f.id] = Number(realVal.toFixed(2));
        
        let boundNote = '';
        if (c.x[fIdx] > 1.001) {
          const pct = Math.round((c.x[fIdx] - 1.0) * 100);
          boundNote = ` *(+${pct}% above tested max of ${f.max})*`;
        } else if (c.x[fIdx] < -0.001) {
          const pct = Math.round((-c.x[fIdx]) * 100);
          boundNote = ` *(-${pct}% below tested min of ${f.min})*`;
        }
        md += `  - ${f.name}: **${candidateFactors[f.id]} ${f.unit || ''}**${boundNote}\n`;
      }
    });
    returnedCandidates.push(candidateFactors);
    md += `\n`;
  });

  if (margin > 0) {
    md += `> **Laboratory Execution Tip:** When exploring conditions outside previously tested bounds (e.g. higher temperatures or catalyst charges), verify chemical compatibility and run confirmatory trials to validate that no unexpected side reactions or thermal degradation occur at the extrapolated settings.\n`;
  }

  return { md, candidates: returnedCandidates };
}

export default function ProjectOptimization({ project, updateProject }: Props) {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [numSuggestions, setNumSuggestions] = useState(3);
  
  const [targetResponseId, setTargetResponseId] = useState<string>(project.responses[0]?.id || '');
  const activeResponse = project.responses.find(r => r.id === targetResponseId) || project.responses[0];
  
  const [goal, setGoal] = useState<'maximize' | 'minimize' | 'target'>((activeResponse?.goal as any) || 'maximize');
  const [targetValue, setTargetValue] = useState<number>(activeResponse?.targetValue ?? 70);
  const [extrapolationMargin, setExtrapolationMargin] = useState<number>(0.30); // Default to 30% extrapolation
  const [customMarginInput, setCustomMarginInput] = useState<string>('30');
  const [surrogateType, setSurrogateType] = useState<'trend_gp' | 'stationary_gp'>('trend_gp');

  const validRunsCount = activeResponse ? project.runs.filter(r => r.responses[activeResponse.id] !== null && r.responses[activeResponse.id] !== undefined && !isNaN(Number(r.responses[activeResponse.id]))).length : 0;
  
  const maxObserved = activeResponse && project.runs.length > 0 
    ? Math.max(...project.runs.map(r => Number(r.responses[activeResponse.id])).filter(v => !isNaN(v)))
    : 0;

  const runOptimization = async () => {
    if (project.runs.length === 0) {
      setError("Add experimental runs before optimizing.");
      return;
    }

    setLoading(true);
    setError('');
    
    setTimeout(() => {
      try {
        const options: OptimizationOptions = {
          numSuggestions,
          targetResponseId: activeResponse?.id || '',
          goal,
          targetValue: Number(targetValue) || 70,
          extrapolationMargin,
          surrogateType,
        };
        const { md, candidates } = runLocalOptimization(project, options);
        updateProject({ ...project, optimizationResults: md, optimizationCandidates: candidates });
      } catch (err: any) {
        setError(err.message || 'An error occurred during optimization');
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const appendSuggestions = () => {
    if (!project.optimizationCandidates || project.optimizationCandidates.length === 0) return;
    
    const newRuns = project.optimizationCandidates.map((c, i) => {
      const runOrder = project.runs.length + i + 1;
      return {
        id: crypto.randomUUID(),
        runOrder: runOrder,
        stdOrder: runOrder,
        factors: c,
        responses: project.responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {})
      };
    });

    updateProject({
      ...project,
      runs: [...project.runs, ...newRuns],
      optimizationCandidates: undefined
    });
  };

  const formattedResults = useMemo(() => {
    if (!project.optimizationResults) return '';
    return project.optimizationResults
      // Clean up raw LaTeX math delimiters like ($R^2 = 80.7\%$) or $R^2 = 80.7%$
      .replace(/\(\$R\^2\s*=\s*([^$)]+?)\\?\$?\)/g, '(R² = $1)')
      .replace(/\$R\^2\s*=\s*([^$]+?)\$/g, 'R² = $1')
      .replace(/Length-scale\s*\$l\s*=\s*([^$]+?)\$/g, 'Length-scale *l* = $1')
      .replace(/\$l\s*=\s*([^$]+?)\$/g, '*l* = $1')
      .replace(/noise\s*\\?\$?\\?sigma_n\s*=\s*([^$]+?)\$?/g, 'noise *σ_n* = $1')
      .replace(/\$\\?sigma_n\s*=\s*([^$]+?)\$/g, '*σ_n* = $1')
      .replace(/\\\$/g, '')
      .replace(/\\%/g, '%');
  }, [project.optimizationResults]);

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-4 flex flex-col text-slate-800 dark:text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <Compass size={18} />
          </div>
          <div>
            <h3 className="font-bold tracking-tight text-xs uppercase text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {locale === 'zh' ? '贝叶斯参数优化器' : 'Bayesian Parameter Optimizer'}
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                {locale === 'zh' ? '最速上升与空间外推' : 'Steepest Ascent & Extrapolation'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {locale === 'zh' ? '高斯过程代理模型与采集函数算法，探索并跨越已知边界寻找更优工艺条件。' : 'Gaussian Process surrogate modeling & acquisition algorithms to navigate beyond tested factor boundaries.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              {locale === 'zh' ? '推荐配方数:' : 'Suggestions:'}
            </label>
            <input 
              type="text" 
              inputMode="numeric"
              value={numSuggestions} 
              onChange={e => {
                const clean = e.target.value.replace(/,/g, '.').replace(/[^0-9]/g, '');
                setNumSuggestions(clean === '' ? 1 : Math.max(1, Math.min(10, Number(clean))));
              }} 
              className="w-12 px-1 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-center" 
            />
          </div>
          <button
            onClick={runOptimization}
            disabled={loading}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? (locale === 'zh' ? '优化求解中...' : 'Optimizing...') : (locale === 'zh' ? '求解最优参数' : 'Run Optimizer')}
          </button>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800">
        {/* Column 1: Response & Goal */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Target size={12} className="text-blue-500" />
            {locale === 'zh' ? '目标响应与优化方向' : 'Response & Target'}
          </label>
          <select 
            value={targetResponseId} 
            onChange={e => {
              setTargetResponseId(e.target.value);
              const resp = project.responses.find(r => r.id === e.target.value);
              if (resp) {
                setGoal((resp.goal as any) || 'maximize');
                if (resp.targetValue !== undefined) setTargetValue(resp.targetValue);
              }
            }}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {project.responses.map(r => (
              <option key={r.id} value={r.id}>{r.name} {r.unit ? `(${r.unit})` : ''}</option>
            ))}
          </select>

          {/* Goal Selector */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => setGoal('maximize')}
              className={`py-1 text-[10px] font-semibold rounded border transition-colors ${
                goal === 'maximize' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {locale === 'zh' ? '最大化' : 'Maximize'}
            </button>
            <button
              type="button"
              onClick={() => setGoal('target')}
              className={`py-1 text-[10px] font-semibold rounded border transition-colors ${
                goal === 'target' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {locale === 'zh' ? '目标值' : 'Target Value'}
            </button>
            <button
              type="button"
              onClick={() => setGoal('minimize')}
              className={`py-1 text-[10px] font-semibold rounded border transition-colors ${
                goal === 'minimize' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {locale === 'zh' ? '最小化' : 'Minimize'}
            </button>
          </div>

          {/* Target Value Input */}
          {goal === 'target' && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{locale === 'zh' ? '目标设定值:' : 'Target Value:'}</span>
              <input 
                type="number"
                step="any"
                value={targetValue}
                onChange={e => setTargetValue(Number(e.target.value))}
                placeholder="e.g. 70"
                className="w-24 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
              />
              <span className="text-[10px] text-slate-500">{activeResponse?.unit || '%'}</span>
            </div>
          )}
        </div>

        {/* Column 2: Search Space & Extrapolation Margin */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ArrowUpRight size={12} className="text-emerald-500" />
              {locale === 'zh' ? '设计空间外推范围' : 'Factor Space Extrapolation'}
            </span>
            <span className="text-[9px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {extrapolationMargin === 0 
                ? (locale === 'zh' ? '严格在边界内' : 'Inside Bounds') 
                : (locale === 'zh' ? `±${Math.round(extrapolationMargin * 100)}% 空间外推` : `±${Math.round(extrapolationMargin * 100)}% Beyond Box`)}
            </span>
          </label>
          
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: '0%', val: 0.0, descEn: 'Strict', descZh: '严格' },
              { label: '±15%', val: 0.15, descEn: 'Slight', descZh: '微调' },
              { label: '±30%', val: 0.30, descEn: 'Recom.', descZh: '推荐' },
              { label: '±50%', val: 0.50, descEn: 'Deep', descZh: '深入' },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setExtrapolationMargin(item.val);
                  setCustomMarginInput(String(Math.round(item.val * 100)));
                }}
                className={`py-1 text-[10px] font-medium rounded border transition-colors flex flex-col items-center ${
                  Math.abs(extrapolationMargin - item.val) < 0.01
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[8px] opacity-75">{locale === 'zh' ? item.descZh : item.descEn}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
            <span>{locale === 'zh' ? '自定义外推幅度:' : 'Custom Margin:'}</span>
            <div className="flex items-center">
              <input 
                type="number"
                min="0"
                max="200"
                value={customMarginInput}
                onChange={e => {
                  setCustomMarginInput(e.target.value);
                  const num = Number(e.target.value);
                  if (!isNaN(num) && num >= 0) {
                    setExtrapolationMargin(num / 100);
                  }
                }}
                className="w-14 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
              />
              <span className="ml-1">%</span>
            </div>
          </div>
        </div>

        {/* Column 3: Surrogate Model Architecture */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Sliders size={12} className="text-purple-500" />
            {locale === 'zh' ? '代理模型架构 (Surrogate)' : 'Surrogate Model'}
          </label>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400">
              <input 
                type="radio" 
                name="surrogateType"
                checked={surrogateType === 'trend_gp'}
                onChange={() => setSurrogateType('trend_gp')}
                className="mt-0.5 text-blue-600"
              />
              <div>
                <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {locale === 'zh' ? '趋势感知高斯过程 (通用克里金)' : 'Trend-Aware GP (Universal Kriging)'}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight mt-0.5">
                  {locale === 'zh' ? '推算响应曲面斜率并在外推边界预测，适用于最速上升法。' : 'Projects response surface slopes (e.g. 60% → 70%) outside bounds. Ideal for Steepest Ascent.'}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2 p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400">
              <input 
                type="radio" 
                name="surrogateType"
                checked={surrogateType === 'stationary_gp'}
                onChange={() => setSurrogateType('stationary_gp')}
                className="mt-0.5 text-blue-600"
              />
              <div>
                <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {locale === 'zh' ? '平稳高斯过程 (Matern 5/2)' : 'Stationary GP (Matern 5/2)'}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight mt-0.5">
                  {locale === 'zh' ? '保守策略。在已知数据点边界外自动回退至历史均值。' : 'Conservative. Reverts to dataset mean outside bounds.'}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>


      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-200 rounded text-[11px] border border-red-200 dark:border-red-800 mb-4 flex items-center gap-2">
          <ShieldAlert size={14} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {project.optimizationResults && (
        <div className="mt-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-bold text-brand-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={13} />
              {locale === 'zh' ? '参数优化建议报告' : 'Optimization Recommendations'}
            </h4>
            {project.optimizationCandidates && project.optimizationCandidates.length > 0 ? (
              <button 
                onClick={appendSuggestions}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded text-[10px] uppercase tracking-wider transition-colors shadow-xs flex items-center gap-1"
              >
                <Sparkles size={11} />
                {locale === 'zh' ? '将建议配方追加到实验矩阵' : 'Append Suggestions to Design Matrix'}
              </button>
            ) : (
              <span className="text-[10px] text-slate-500 italic">
                {locale === 'zh' ? '点击“求解最优参数”生成推荐方案。' : "Click 'Run Optimizer' to generate suggestions."}
              </span>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert prose-slate max-w-none text-[11px] prose-p:leading-relaxed bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-3 border border-slate-200 dark:border-slate-700/80 rounded-lg shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left border-collapse" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-slate-100/80 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-semibold" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700" {...props} />
                ),
                tbody: ({ node, ...props }) => (
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900" {...props} />
                ),
                tr: ({ node, ...props }) => (
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-3.5 py-2 text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 mb-2 tracking-tight flex items-center gap-2" {...props} />
                ),
                h4: ({ node, ...props }) => (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mt-5 mb-2 border-b border-slate-100 dark:border-slate-800/80 pb-1" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-amber-500 bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 p-3 my-3 rounded-r text-[11px] not-italic" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc pl-5 space-y-1 my-2 text-slate-700 dark:text-slate-300" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="leading-relaxed" {...props} />
                ),
              }}
            >
              {formattedResults}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {!project.optimizationResults && !loading && !error && (
        <div className="py-8 text-center text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded border border-dashed border-slate-300 dark:border-slate-700">
          {locale === 'zh' 
            ? '请在上方选择优化目标响应与外推幅度，然后点击“求解最优参数”。' 
            : 'Select your optimization target and extrapolation margin above, then click "Run Optimizer".'}
        </div>
      )}
    </div>
  );
}
