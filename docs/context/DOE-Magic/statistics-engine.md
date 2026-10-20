# DOE-Magic — Statistics Engine

> Created: 2026-10-20. Status: reference for the current code (branch `chore/project-structure-and-core-docs`). It describes what the engine does today, defects included. It does not describe intended behaviour.
> Related: [Design generation](design-generation.md), [MCP server](mcp-server.md), [Web UI](web-ui.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md), [source](../../../src/core/analysis/analysisCore.ts)

Audience: a statistician or AI agent who has to fix the engine. Every statement here was checked against `src/core/analysis/analysisCore.ts` (1,295 lines). Lines marked *run* were re-run against the current code on 2026-10-20; the method is in [How to verify numerically](#how-to-verify-numerically).

## Summary

- One file, `src/core/analysis/analysisCore.ts`, is pure TypeScript. Its only dependencies are `jstat` and `../types`. It does no I/O and touches no DOM, so it runs in the browser and in Node.
- It fits **one response at a time** with OLS on a **fixed model**: intercept, all main effects and all two-factor interactions (2FIs), minus the terms the user excluded. There are never quadratic, three-factor or block terms, whatever the design type.
- It returns everything in one untyped object: ANOVA, lack of fit, Type III effect tests, parameter estimates, Pareto and half-normal data, residual diagnostics, Box-Cox, and a single-response optimum. Two members of that object are closures.
- Four results are known to be wrong for common designs: [STAT-1](#known-issues) (wrong inverse when the model is rank-deficient), STAT-2 (Lenth scaling), STAT-3 (no quadratic terms) and STAT-4 (truncated optimum search). The [Known issues](#known-issues) section lists them all.

## Public API

| Export | Line | Signature | Purpose |
|---|---|---|---|
| `getFactorContrasts` | 58 | `(factor: Factor, runVal: any): number[]` | Turns one raw factor value into its model-matrix columns. |
| `computeAnalysis` | 186 | `(project: Project, activeResponse: Response, excludedTerms: string[], effectiveGoal: string \| undefined, effectiveTargetValue: number \| undefined)` (all five arguments are required; the last two may be `undefined`) | Runs the whole analysis for one response. Returns `null` when there are no runs or factors, no response, or no run with a value (lines 187-192). |
| `predictModelResponse` | 1192 | `(analysisResult: any, factorSettings: Record<string, any>, project: Project): number` | Predicts the response at any setting, using one of three strategies. |

Internal helpers: `normSInv` (5-48, Acklam's inverse normal, used only for the half-normal plot), `transpose` (91), `multiply` (95) and `solveOLS` (109-184). No types are exported, and the return type of `computeAnalysis` is inferred, mostly as `any`.

## Who calls what

| Caller | Call site | Notes |
|---|---|---|
| Analysis tab | `src/web/features/analysis/ProjectAnalysis.tsx:265` (every response), `:276` (active response) | The active response uses the goal and target typed into the tab (`:182-183`). Other responses are fitted with `excludedTerms = []` (`:262`, STAT-7). |
| Prediction Profiler | `src/web/features/analysis/PredictionProfiler.tsx:62` | `predictModelResponse` on the results from `ProjectAnalysis.tsx:265`. |
| Response surface | `src/web/features/analysis/ProjectAnalysis.tsx:491` | `predictModelResponse` per grid point. |
| Compare tab | `src/web/features/compare/CompareResponses.tsx:121`, `:240` | Uses `resp.excludedTerms`. |
| Robustness tab | `src/web/features/robustness/RobustnessSimulation.tsx:72`, `:145`, `:216` | Uses `resp.excludedTerms`. |
| Excel export | `src/web/pages/ProjectView.tsx:223` | Uses `resp.excludedTerms`. |
| HTML export | `src/web/features/export/htmlExport.ts:9` | Copies selected fields into the report (`:11-27`). The report re-implements prediction (STAT-8). |
| MCP `run_analysis` | `src/server/mcp/doeMcpServer.ts:624` | `excludedTerms` from the tool call, else from the response. |
| MCP `predict_response` | `src/server/mcp/doeMcpServer.ts:723`, `:732` | |
| MCP `optimize_desirability` | `src/server/mcp/doeMcpServer.ts:794`, `:884` | |
| MCP `simulate_robustness` | `src/server/mcp/doeMcpServer.ts:989`, `:1027` | |
| MCP resource `doe://analysis` | `src/server/mcp/doeMcpServer.ts:1213` | |
| D-optimal design | `src/core/design/dOptimal.ts:19` | Uses `getFactorContrasts` only, for the same coding. |

`server.ts` does not import the engine directly. It reaches it only through the MCP server.

## Pipeline

```text
runs ─► filter on response (191) ─► code factors (58-88) ─► model terms & IDs (216-329) ─► X, Y (334-349)
   ─► solveOLS (109-184) ─► effects for plots (358-451) ─► whole-model ANOVA (455-480)
   ─► lack of fit / pure error (483-536) ─► error term: MSE or Lenth (539-566)
   ─► Type III effect tests (571-631) ─► Pareto / half-normal (633-702)
   ─► prediction + intervals (705-755) ─► desirability + grid optimum (758-895)
   ─► VIF + parameter estimates (897-990) ─► residual diagnostics (993-1063) ─► Box-Cox (1066-1151)
   ─► result object (1153-1184)
```

### 1. Inputs and run filtering

- `excludedTerms` holds **term IDs**, not names: a main effect's ID is the factor `id`, and a 2FI's ID is `` `${f1.id}*${f2.id}` `` with `f1` before `f2` in `project.factors` order (lines 220, 278-279).
- `effectiveGoal` is `'maximize' | 'minimize' | 'target'`, and `effectiveTargetValue` is a number. Both are used only by the desirability step.
- A run is used when its response is not `null`, `undefined` or `''` (line 191). There is no other check:
  - a non-numeric string or `NaN` passes the filter and turns every result into NaN (STAT-26);
  - runs whose factor values are missing or invalid are kept (STAT-11).
- `Run` has no "exclude this run" flag (`src/core/types.ts:29-35`).

### 2. Factor coding — `getFactorContrasts` (58-88)

| Factor | Columns | Coding |
|---|---|---|
| Numeric | 1 | `2(x − mid)/range`, with `mid = (min+max)/2` and `range = max − min` (1 when `min == max`). Clamped to [−2, 2] (line 86, STAT-14). `NaN` codes to 0 (the centre). `Number('')` and `Number(null)` are 0, so a blank value is coded as the natural value 0, not the centre (STAT-11). |
| Categorical, 1-2 levels | 1 | `levels[1]` → +1. Every other value → −1, including unknown labels. With one level, every run is −1 and the column is named `name[undefined]` (STAT-27). |
| Categorical, L ≥ 3 levels | L − 1 | Sum-to-zero (effect) coding. Level j < L−1 has +1 in column j; the last level is the reference, with −1 in every column. |

- Categorical values are matched case-insensitively after trimming. If no label matches, a numeric value in `[0, L)` is used as a level index. Otherwise the value becomes level 0 without any warning (lines 62-68).
- The default levels are `['Level 1', 'Level 2']`.
- The doc comment at line 52 says numeric values are coded into [−1, +1]. The code clamps at ±2.

### 3. Model specification (216-329)

- The terms are: intercept, then one main effect per factor (df = 1, or L − 1), then every pair of factors as a 2FI. An interaction's columns are all products of its parents' contrast columns (Kronecker order, lines 287-293 and 304-314), so its df is `df1 × df2`.
- There are **no** quadratic terms (STAT-3), no 3FIs and no block terms. The model does not depend on `project.designType`.
- Excluded terms get `isExcluded = true` and no columns. Hierarchy is not enforced: you can drop a main effect and keep its interactions.
- Active terms get column indices from 1 (column 0 is the intercept) in declaration order (lines 322-329). `numTerms = 1 + Σ df` over the active terms.
- Column names:
  - numeric: `name`;
  - categorical: `name[level]`;
  - interaction: `a*b`.

  These names appear in `parameterEstimates.term`.

### 4. OLS solve — `solveOLS` (109-184)

1. It forms `X'X` and `X'Y` explicitly (113-115).
2. It runs Gauss-Jordan elimination with partial **row** pivoting on `[X'X | X'Y | I]` (128-163).
3. A column whose largest remaining pivot is below an **absolute** 1e-9 is marked aliased, and its coefficient stays 0 (138-141).
4. It returns `beta`, `diagInv`, `invXtX`, `aliased` and `rank`. Rows and columns of aliased terms in `invXtX` are 0.

The coefficients are correct even when the model is rank-deficient (STAT-1, *run*). `diagInv` and `invXtX` are read at `aug[r][k+1+c]` (172-178), which is valid only if the pivot rows coincide with the estimable columns. That can fail whenever the model is rank-deficient, which the default model is for Plackett-Burman (PB), "DSD" and D-optimal designs. It failed for PB12 with 6 factors and 3 centre points (*run*) and, per an earlier reader's notes (not re-run here), for the 6-factor "DSD"; a regular 2^(4−1) with centre points came out correct. Do not assume a design is safe without the leverage check below.

The values below depend on `diagInv` and `invXtX`:

- 1-df Type III SS (586);
- standard errors and t (935-940);
- reference-level SE (962-969);
- VIF (909);
- interval leverage `h00` (736);
- residual leverage, studentized residuals and Cook's D (1012-1032);
- Box-Cox (1094).

The multi-df Type III SS (589-601) uses only SSE from a refit. It therefore depends only on `beta`, so it should not be affected (*by reading, not run*).

### 5. Whole-model ANOVA (455-480)

| Quantity | Definition in code |
|---|---|
| SSE, SST | Residual SS and SS about the mean of the valid runs |
| `p_model` | `rank − 1` |
| `df_error` | `max(0, n − rank)` |
| MSE | `SSE/df_error`, or **0** when `df_error = 0` (line 470, STAT-5) |
| F | `MS_model / MSE`, or 0 when MSE = 0 |
| R² | `1 − SSE/SST` |
| adj R² | `1 − (1 − R²)(n − 1)/df_error`, or 0 when `df_error = 0` |

There is no model p-value, PRESS or predicted R² (STAT-22). The result field `p` (line 1164) is `p_model`, a **degrees-of-freedom count**, and so is `optimalConditions.pModel` (line 890). MCP reports `p` as a p-value (MCP-1), and so does the HTML export (UI-31).

### 6. Lack of fit and pure error (483-536)

- Runs are grouped by their settings of every factor that appears in any active term. Numeric settings use `toFixed(6)` of the raw value; categorical settings use the trimmed, lower-cased label.
- Pure error is pooled within groups that have ≥ 2 runs.
- `df_lof = max(0, df_error − df_pure)` and `SS_lof = max(0, SSE − SS_pure)`.
- `p_lof` comes from `jStat.centralF` and is set only when `df_lof > 0`, `df_pure > 0`, `MS_pure > 0` and `F_lof > 0`. Otherwise it is `null`.
- `F_lof = Infinity` when `MS_pure = 0` and `MS_lof > 0`.
- Callers must treat `p_lof = null` as "not testable" (MCP-8 shows a caller that does not).

### 7. Error term for the effect tests (539-566)

- The error term is normally MSE with `df_error`.
- A fallback to pure error exists (543-546), but it is effectively unreachable because `df_pure ≤ df_error` (STAT-25).
- **Lenth path.** When `test_df ≤ 0` or `test_ms === 0`, the code switches to Lenth's pseudo standard error (PSE):
  - The pool is the `absEffect` of every non-aliased main effect and interaction (552-555). Excluded terms count as not aliased (empty `colIndices`), so they enter the pool:
    - an excluded numeric term or interaction enters as 0;
    - an excluded categorical main effect enters with its raw range (STAT-2, STAT-15).
  - `s0 = 1.5·median`, then `PSE = 1.5·median(|e| < 2.5·s0)`.
  - The pseudo mean square is `PSE²/(n/4)` (line 563). This should be `n·PSE²/4`, because effect = 2β, so t is inflated by n/4 and F by (n/4)² (STAT-2, *run*).
  - The df is `max(1, floor(m/3))`, where m is the pool size.
- `paretoThreshold = 2.12·PSE` is computed and returned, but no caller reads it (STAT-25).

### 8. Type III effect tests (571-631)

- **1-df terms:** `SS = β²/diagInv`.
- **Multi-df terms:** drop the term's columns, refit with `solveOLS`, and take `SS = SSE_reduced − SSE`.
- Then `F = (SS/df)/test_ms`, p from `jStat.centralF` (floored at 1e-15) and `logworth = −log10 p`.
- Aliased and excluded terms get `SS = 0` and `p = 1`. Aliased terms get " (Aliased)" appended to their name.
- `effectSummary` contains **all** terms, excluded ones included (flag `isExcluded`). It is sorted by logworth, with aliased terms last.
- Each entry has `name, logworth, pVal, ss, fRatio, df, nparm, isAliased, isExcluded, id`.

### 9. Parameter estimates and VIF (897-990)

- `SE = √(MSE·diagInv)`, `t = β/SE`, and p is two-sided from Student t with `df_error`. When `df_error = 0`, MSE is 0, so SE = 0, t = 0 and p = 1 (STAT-5, *run*).
- `VIF = diagInv·Σ(x − x̄)²`, floored at 1, and `Infinity` for aliased columns. This formula is correct for a full-rank model with an intercept.
- For categorical factors with L ≥ 3, the code adds a reference-level row:
  - estimate `−Σβ` and `SE = √(MSE·1'V1)`, where V is the term's `invXtX` block;
  - `stdError`, `tRatio` and `pVal` can be `undefined` (969-974), which crashes MCP (MCP-9).
- Estimate rows carry `term`, `cleanTerm`, `factorId`, `f1Id`, `f2Id`, `isAliased`, `vif` and, for reference rows, `isReference`.

### 10. Effects for the Pareto and half-normal plots (358-451, 633-702)

**`effects`** (per factor):

- Numeric factors:
  - `effect = 2β` of the factor's column, or 0 if the term is excluded;
  - plus raw `lowAvg`, `highAvg` and `centerAvg`. A run counts as centre when it is within 15% of the half-range from the midpoint.
- Categorical factors:
  - `effect` is the max − min of the raw level means, computed even when the term is excluded;
  - a level with no runs averages 0;
  - `highCount` = all runs and `lowCount` = 0 (STAT-15).

**Interactions:**

- `effect = 2β` of the **first** column only.
- An internal `interactions` array is built (430-451) but is **not** returned. Interaction effects reach callers only through `paretoData`, `halfNormalData` and `effectSummary`.

**Plotted quantity:**

- `tRatio = √F` from the Type III table, falling back to `|β/SE|` (652, 663). For multi-df terms this is not a t statistic (STAT-20).
- `paretoData` holds the non-aliased, non-excluded terms sorted by `tRatio`. Each item is `{name, absEffect, direction, factor, tRatio}`.

**Half-normal:**

- Terms are sorted by `tRatio`, with quantile `Φ⁻¹(0.5 + 0.5(i − 0.5)/m)`.
- A line through the origin is fitted to the smallest `floor(m/2)` points (682-699).
- `significant` is `tRatio > tLimitPareto`.

**Limits:**

- `tLimitPareto = t(0.975, df_error)`, or 3 when `df_error = 0` (646).
- `bonferroniLimitPareto = t(1 − 0.05/(2·#active terms), df_error)`, or 3.5 (702).

### 11. Prediction and intervals (705-755)

- `predictAtSettings(settings)` builds a model row with the same coding and sums `β·x` over non-aliased columns.
- A factor missing from `settings` is coded as described in §2:
  - numeric: centre (`NaN` → 0);
  - categorical: first level.
- `getPointStats` computes:
  - `h00 = x0'(X'X)⁻¹x0`;
  - `seMean = √(MSE·h00)` and `sePred = √(MSE(1 + h00))`;
  - `t(0.975, df_error)`, falling back to 1.96;
  - CI and PI.
- It runs **only at the optimum** (line 825) and is not exported, so no caller can get an interval at any other setting (MCP-15). With `df_error = 0` both intervals have zero width (STAT-5).

### 12. Single-response desirability and grid optimum (758-895)

The comment says Derringer-Suich. The code is:

| Goal | d(ŷ) |
|---|---|
| maximize | linear from observed `yMin` (d = 0) to `U = targetValue ?? yMax` (d = 1), clipped to [0, 1]. If `U ≤ yMin`, d = 1. |
| minimize | mirror image, linear from `L = targetValue ?? yMin` (d = 1) to `yMax` (d = 0). |
| target | symmetric triangle around `targetValue ?? mean(y)`, with half-width `0.5·(yMax − yMin)`. |

**Ranking score:** `1000·d ± ŷ`. The ± term only breaks ties: +ŷ for maximize, −ŷ for minimize, −|ŷ − T| for target.

**Search:**

- Candidates are `{min, mid, max}` for each numeric factor and every level of each categorical factor.
- Combinations are built factor by factor, and after each step the list is **cut to the first 512** (810). The first factor varies slowest, so:
  - with 6 numeric factors the first factor reaches its max in only 26 of 512 combinations;
  - with 7 or more it never leaves its min (STAT-4, *run*).

**Per-factor output (`optimalConditions.factors`):**

- `optimalValue`, rounded to 1 or 2 decimals (865, STAT-19);
- `codedValue` and `codedLabel`;
- `naturalSlope`, a central finite difference inside [min, max] with a step of 0.5% of the range;
- `codedSlope` and `effectValue`.

Categorical factors get `codedValue` 0, `codedSlope` 0, `effectValue` 0 and `naturalSlope` `null`.

`optimalConditions` also carries:

- `expectedY` and `desirability`;
- `seFit`, `sePred`, `leverage` and `tCrit`;
- the CI and PI;
- `rmse`, `rSquared`, `adjRSquared`, `fRatio`, `pModel` (a DF count) and `dfError`.

This is the only optimiser in the engine, and it handles one response. Multi-response optimisation lives elsewhere (see [Not in the engine](#not-in-the-engine)).

### 13. Residual diagnostics and adequate precision (993-1063)

- Per valid run:
  - leverage `h_ii`;
  - internally studentized residual `r = e/√(MSE(1 − h))`, set to 0 when `MSE ≤ 1e-9` or `h ≥ 0.9999`;
  - Cook's D `= r²/p · h/(1 − h)`, with `p = max(1, rank)`.
- Flags:
  - influential: D > 1, or D > 4/n when n > 25;
  - high leverage: h > 2p/n;
  - outlier: |r| > 2.5.
- Each row carries `limit` (`t(0.975, df_error)`, or 3) and `bonferroniLimit` (`t(1 − 0.05/(2n), df_error)`, or 3).
- `run` is the position among the valid runs, not `runOrder` (1041, STAT-18).
- Adequate precision is `(max ŷ − min ŷ)/√(p·MSE/n)`. When MSE ≈ 0 it is replaced by a sentinel: 99.9 if ŷ varies, otherwise 0.
- `actualByPredicted` holds `{actual, predicted}` pairs.

### 14. Box-Cox (1066-1151)

- The response is shifted by `|min| + 1` when `min ≤ 0`.
- The transform is normalised by the geometric mean, with λ from −2 to 2 in steps of 0.1.
- `logL = −(n/2)·ln(SSE_λ/n)`. The refit reuses `invXtX`, so it is affected by STAT-1.
- The 95% CI is every λ with `logL ≥ max − 1.92`.
- The recommendation is the nearest of λ ∈ {−1, −0.5, 0, 0.5, 1, 2}.
- When SSE ≤ 1e-12, `logL = 0` for every λ, so λ = −2 wins and "Inverse (1/Y)" is recommended (STAT-21, *run*).
- The returned grid keeps every second point.
- The whole block is wrapped in `try`, and returns `null` on error.

### 15. The result object (1153-1184)

The fields are:

- `response`, `effects`, `paretoData`;
- `optimalSettings` (equal to `optimalConditions.factors`) and `optimalConditions`;
- `halfNormalData`, `halfNormalLine`, `bestPred`;
- `rSquared`, `adjRSquared`, `p` (DF), `nRuns`;
- `paretoThreshold`, `tLimitPareto`, `bonferroniLimitPareto`;
- `effectSummary`, `lackOfFit`, `parameterEstimates`;
- `rmse`, `fRatio`, `dfError`, `mse`;
- `actualByPredicted`, `studentizedResiduals`, `adequatePrecision`, `boxCox`;
- `activeEffects`, `beta`, `aliased`, `predictAtSettings`.

`predictAtSettings` and `activeEffects[].getContrasts` are closures. JSON serialisation drops them and turns `Infinity` (for example VIF or `f_lof`) into `null`.

## `predictModelResponse` strategies (1192-1295)

1. If `analysisResult` is null, return **0** (1197). MCP relies on this silently (MCP-12).
2. If the `predictAtSettings` closure exists and returns a finite value, use it.
3. If `activeEffects` and `beta` exist, rebuild the prediction from them with `getFactorContrasts`. This works after JSON serialisation, because each effect keeps `factor`, `f1`, `f2` and `colIndices`.
4. Otherwise parse `parameterEstimates`. This path uses only the first contrast of each factor, which is wrong for categorical factors with three or more levels (STAT-24). No current caller reaches it.
5. Otherwise return 0.

## Not in the engine

These calculations live outside `src/core` and are separate implementations. They are documented in [Web UI](web-ui.md) and [MCP server](mcp-server.md).

| Calculation | Where | Relation to the engine |
|---|---|---|
| Gaussian-process / Bayesian optimiser (Cholesky, EI, trend) | `src/web/features/optimization/ProjectOptimization.tsx:23-593` | Does not call the engine at all; has its own surrogate (STAT-10, STAT-13). |
| Monte Carlo robustness | `src/web/features/robustness/RobustnessSimulation.tsx:103-240`; MCP `simulate_robustness` at `src/server/mcp/doeMcpServer.ts:965` | Both call `predictModelResponse` plus optional N(0, RMSE) noise; no parameter uncertainty; different rules (STAT-9, MCP-16). |
| Multi-response desirability | `src/web/features/analysis/PredictionProfiler.tsx:13-84`; MCP `optimize_desirability` at `src/server/mcp/doeMcpServer.ts:776` | Different d-functions from §12 and from each other (STAT-6). |
| Main-effect and interaction plot means, surface grids | `src/web/features/analysis/ProjectAnalysis.tsx:283-582`, `:2020-2116`; `src/web/features/compare/CompareResponses.tsx:124-319`; `src/web/features/export/htmlExport.ts:1138-1147`, `:1223-1345` | Recomputed from raw runs or a surrogate (STAT-8, STAT-16). |
| Diagnostic rules ("Key Drivers", warnings) | `src/web/features/analysis/ProjectAnalysis.tsx:584-1053` | Reads engine output (STAT-23). |

## Known issues

These are from the issue registry. The fix plans and their order are in the [roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md); search for the ID.

| ID | Sev. | One line |
|---|---|---|
| STAT-1 | Critical | `(X'X)⁻¹` is wrong for rank-deficient models, so SEs, p-values, VIF, leverage, Cook's D, intervals and Box-Cox are wrong. Coefficients are correct. |
| STAT-2 | Critical | Lenth pseudo-MS is `PSE²/(n/4)` instead of `n·PSE²/4`, so t is inflated n/4 and F (n/4)²; the pool includes excluded terms and raw categorical ranges. |
| STAT-3 | Critical | No quadratic terms, so CCD/BBD/DSD data is fitted with a 2FI model. |
| STAT-4 | Critical | The optimum grid is truncated to the first 512 combinations; wrong optimum with ≥ 6 numeric factors. |
| STAT-5 | High | `df_error = 0` gives SE 0, t 0, p 1 and zero-width CI/PI, contradicting the Lenth effect tests. |
| STAT-6 | High | Three different desirability formulas (engine, Profiler, MCP). |
| STAT-7 | High | The Profiler fits non-active responses with the full model, ignoring their excluded terms. |
| STAT-8 | High | HTML export surfaces use a main-effects-only surrogate. |
| STAT-9 | High | Monte Carlo understates spread and is implemented twice. |
| STAT-10 | High | The Bayesian optimiser turns a target of 0 into 70. |
| STAT-11 | High | Missing or unparseable factor values are coded as real settings. |
| STAT-12 | High | MCP `run_analysis` misreports fields and can crash. |
| STAT-13 | Medium | The Bayesian optimiser's surrogate is ad hoc and overconfident by default. |
| STAT-14 | Medium | Coded values are clamped to [−2, 2]. |
| STAT-15 | Medium | Categorical and multi-column effect magnitudes are not model-based. |
| STAT-16 | Medium | Effect-plot and surface data are recomputed in three forks. |
| STAT-17 | Medium | Excel export hard-codes Nparm = 1 and DF = 1. |
| STAT-18 | Medium | Residuals and run plots are labelled by array position. |
| STAT-19 | Medium | Optimal and suggested settings are rounded to 2 decimals. |
| STAT-20 | Low | Pareto/half-normal use √F for multi-df terms against a 1-df t limit. |
| STAT-21 | Low | Box-Cox recommends 1/Y for a perfect fit. |
| STAT-22 | Low | No model p-value, PRESS or predicted R². |
| STAT-23 | Low | "Key Drivers" sorts by a missing field and matches by name prefix. |
| STAT-24 | Low | The fallback predictor uses only the first contrast for categorical factors with three or more levels. |
| STAT-25 | Low | Dead and duplicated code (pure-error fallback, `paretoThreshold`, `stdErrors`, `normSInv`, unused jStat import in `dOptimal.ts`). |
| STAT-26 | Low | Non-numeric response values pass the run filter (*plausible-unverified*). |
| STAT-27 | Low | A 1-level categorical factor gets the column name `name[undefined]` (line 225) and a constant −1 contrast column (`getFactorContrasts`, 58-88, lines 70-71). The column is collinear with the intercept, so the term is reported as aliased. |

These issues in other areas involve engine outputs: MCP-1, MCP-6, MCP-7, MCP-8 and MCP-9 (`run_analysis` mapping), MCP-3 and MCP-11 (desirability search), UI-3, UI-5, UI-24 and UI-31 (the HTML report prints the DF field `p` as "Model p-value").

### Findings from this review, now registered

- **HTML export shows the model DF as "Model p-value"** (UI-31). It copies `res.p` (`src/web/features/export/htmlExport.ts:27`), which is `p_model = rank − 1`, and prints it under the label "Model p-value" (`:736`, `:750`). For both demo-project responses `p` is 14 (*run*), so the report shows "14.0000". This has the same root cause as MCP-1, and the fix (a real `modelPValue` in core, backlog P0.5) covers both callers.
- **`optimalConditions.pModel` is a DF count** (`analysisCore.ts:890`, part of UI-31). Nothing reads it today. Its name clashes with the `pModel` field name suggested in the MCP-1 fix, so rename it (for example to `dfModel`) when that fix lands.
- **A categorical factor with one level** (STAT-27) gets the column name `name[undefined]` (line 225) and a constant −1 column. That column is collinear with the intercept, so the term is reported as aliased. Input validation should reject such factors (backlog P1.10).

## How to verify numerically

Keep verification scripts **outside the repo** ([lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)) until the vitest suite exists (BLD-4).

1. Write a `.mts` file. It needs top-level `await`, and `tsx` compiles a `.ts` file outside the repo (no `"type": "module"` package.json) as CommonJS, which rejects it.
2. Import the engine through `pathToFileURL('<repo>/src/core/analysis/analysisCore.ts')`.
3. Run it with `<repo>/node_modules/.bin/tsx file.mts`.

The checks below were run on 2026-10-20 and give the results shown. The STAT-5 and STAT-4 runs used different Y data from the registry's runs, so their CI and desirability values differ from the registry and backlog figures (CI [15.28, 15.28]; desirability 0.045); the failure pattern is the same.

| Check | Setup | Invariant | Current result |
|---|---|---|---|
| STAT-1 | `generateDesign(6 numeric, 'plackett_burman', {centerPoints: 3})`, any Y, `excludedTerms = []` | `Σ studentizedResiduals[i].leverage == rank` (`rank = p + 1`), every `h ≤ 1` | rank 12, `df_error` 3, Σh = 11.000, max h = 1.067 |
| STAT-2 | Regular 2^(4−1) (D = ABC), 8 runs, default model, `df_error = 0` | Plotted `paretoData.tRatio` equals the Lenth t, `|2β|/PSE` over the 7 estimable contrasts | ratio = 2.000 = n/4 |
| STAT-5 | Same design | Parameter-estimate SE > 0 or "not estimable"; CI width > 0 | SE 0, t 0, p 1; optimum CI `[25.000, 25.000]` |
| STAT-21 | Same design | Box-Cox `null` when SSE ≈ 0 | `optimalLambda = −2`, "Inverse (1/Y)" |
| STAT-4 | 2^k full factorial, Y = 10 ± 5 on F0 (+0.1 on other factors), maximize | Optimum F0 = max | k = 5: F0 = 100 (correct); k = 7: F0 = 0, desirability 0.10 |

Reference values for fixes:

- compare against a reduced full-rank model fitted on the estimable columns (STAT-1);
- Lenth (1989), *Technometrics* 31:469-473 (STAT-2);
- JMP or R `lm` and `anova` for every table, starting with the demo project.

AGENTS.md requires a reference test before any statistics change.
