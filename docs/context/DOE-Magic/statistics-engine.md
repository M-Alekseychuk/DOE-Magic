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

### 1. Inputs and run validation (`validateRuns`)

- `excludedTerms` holds **term IDs** or display names/aliases resolved by `resolveExcludedTerms`: a main effect's ID is the factor `id`, a 2FI's ID is `` `${f1.id}*${f2.id}` `` with `f1` before `f2` in `project.factors` order, and a quadratic term's ID is `` `${f.id}^2` ``.
- `effectiveGoal` is `'maximize' | 'minimize' | 'target'`, and `effectiveTargetValue` is a number. Both are used only by the desirability step.
- `validateRuns(project, activeResponse)` (`src/core/analysis/modelSpec.ts`, P1.11 / STAT-11, STAT-14, STAT-26) checks every run before fitting:
  - A run is excluded and recorded in `excludedRuns: { runId, runOrder, reason }[]` if any numeric factor is missing (`null`, `undefined`, `''`) or not a finite number, if any categorical factor does not match a defined level (trimmed, case-insensitive), or if the response value is missing (`null`, `undefined`, `''`) or not a finite number (such as `'12.5a'`).
  - Valid runs whose numeric factor values fall outside `[min, max]` (`|coded| > 1`) are kept, coded at their true value without clamping, and reported in `warnings: string[]` as extrapolated.

### 2. Factor coding — `getFactorContrasts` (`src/core/analysis/modelSpec.ts`)

| Factor | Columns | Coding |
|---|---|---|
| Numeric | 1 | `2(x − mid)/range`, with `mid = (min+max)/2` and `range = max − min` (0 when `min == max`). **Unclamped** (P1.11 / STAT-14): values outside `[min, max]` retain their true coded value `2(x − mid)/range`. |
| Categorical, 1-2 levels | 1 | `levels[1]` → +1, `levels[0]` → −1. |
| Categorical, L ≥ 3 levels | L − 1 | Sum-to-zero (effect) coding. Level j < L−1 has +1 in column j; the last level is the reference, with −1 in every column. |

- Categorical values are matched case-insensitively after trimming. Unknown categorical labels are rejected by `validateRuns` (P1.11 / STAT-11).
- The default levels are `['Level 1', 'Level 2']`.

### 3. Model specification (`src/core/analysis/modelSpec.ts`)

- The terms are: intercept, then one main effect per factor (df = 1, or L − 1), then every pair of factors as a 2FI, and—when quadratic terms are enabled for the design—one quadratic term `${f.id}^2` per numeric factor that has at least 3 distinct coded levels in the valid runs (P0.9 / STAT-3).
- Quadratic terms are included by default when `project.designType` is `'ccd'`, `'bbd'`, `'dsd'` or `'custom_d_optimal'`, or when `project.designType` is unset and the numeric factors have ≥ 3 distinct levels that are not merely a single shared centre-point indicator on a 2-level design and the 2FI model has spare degrees of freedom (`nRuns > 1 + pMain + pInt`).
- Excluded terms get `isExcluded = true` and no columns. Both `${f.id}^2` and `${f.id}*${f.id}` are recognised in `excludedTerms`.
- Active terms get column indices from 1 (column 0 is the intercept) in declaration order. `numTerms = 1 + Σ df` over the active terms.
- Column names:
  - numeric: `name`;
  - categorical: `name[level]`;
  - interaction: `a*b`;
  - quadratic: `a*a`.

  These names appear in `parameterEstimates.term`.

### 4. OLS solve — `solveOLS` (`src/core/analysis/linalg.ts`)

1. Columns of `X` are processed sequentially in model order using two-pass modified Gram-Schmidt QR (`X_S = Q_S R_S`).
2. A column whose residual Euclidean norm after projecting out earlier kept columns is `≤ 1e-9 · max(1, ‖col‖₂)` is marked aliased (`aliased[j] = true`), and its coefficient is 0. This keeps the later term in model order as the aliased one.
3. `beta` on the kept columns `S` is solved by back-substitution on `R_S β_S = Q_S' Y`.
4. `(X_S'X_S)⁻¹` is computed as `R_S⁻¹ (R_S⁻¹)'` and placed at the `(kept[a], kept[b])` indices of `invXtX` (with 0 on aliased rows and columns).
5. It returns `beta`, `diagInv`, `invXtX`, `aliased`, `rank` and `kept`.

### 5. Whole-model ANOVA

| Quantity | Definition in code |
|---|---|
| SSE, SST | Residual SS and SS about the mean of the valid runs |
| `p_model` (`dfModel`) | `rank − 1` |
| `df_error` (`dfError`) | `max(0, n − rank)` |
| MSE | `SSE/df_error`, or **0** when `df_error = 0` |
| F | `MS_model / MSE`, or 0 when MSE = 0 |
| `modelPValue` | `1 − F_cdf(F; dfModel, dfError)` when `df_error > 0` and `dfModel > 0`, or `null` when `df_error = 0` (P0.5 / MCP-1 / UI-31) |
| R² | `1 − SSE/SST` |
| adj R² | `1 − (1 − R²)(n − 1)/df_error`, or 0 when `df_error = 0` |

There is no PRESS or predicted R² (STAT-22). `dfModel` holds the model degrees of freedom (`rank − 1`), `modelPValue` holds the whole-model F-test p-value (or `null` when `dfError === 0`), and `p` is retained only as a deprecated alias for `dfModel`.

### 6. Lack of fit and pure error

- Runs are grouped by their settings of every factor that appears in any active term. Numeric settings use `toFixed(6)` of the raw value; categorical settings use the trimmed, lower-cased label.
- Pure error is pooled within groups that have ≥ 2 runs.
- `df_lof = max(0, df_error − df_pure)` and `SS_lof = max(0, SSE − SS_pure)`.
- `p_lof` comes from `jStat.centralF` and is set only when `df_lof > 0`, `df_pure > 0`, `MS_pure > 0` and `F_lof > 0`. Otherwise it is `null`.
- `F_lof = Infinity` when `MS_pure = 0` and `MS_lof > 0`.
- Callers must treat `p_lof = null` as "not testable" (MCP-8 shows a caller that does not).

### 7. Error term for the effect tests and `computeLenth`

- The error term is normally MSE with `df_error`.
- **Lenth path (`df_error = 0`, P0.4 / STAT-2).** `computeLenth(contrasts)` implements Lenth (1989, *Technometrics* 31:469–473):
  - The pool is the `2β` contrast of every active, non-aliased, 1-df term (`!isExcluded && !isAliased && df === 1`).
  - `s0 = 1.5 · median(|c|)`, `PSE = 1.5 · median(|c| < 2.5 · s0)` using standard median (averaging the two middle values when the count is even).
  - `df = m / 3`, `ME = t(0.975, df) · PSE`, `SME = t(γ, df) · PSE` where `γ = (1 + 0.95^(1/m)) / 2`.
  - For each 1-df term, `tRatio = |2β| / PSE` and `fRatio = tRatio²` (equivalent to `test_ms = n · PSE² / 4` on orthogonal 2-level designs).

### 8. Type III effect tests

- **1-df terms:** `SS = β²/diagInv`.
- **Multi-df terms:** drop the term's columns from the kept estimable columns `kept`, refit with `solveOLS`, and take `SS = SSE_reduced − SSE`.
- When `df_error > 0`, `F = (SS/df)/MSE`, p from `jStat.centralF` (floored at 1e-15) and `logworth = −log10 p`. When `df_error = 0` and Lenth applies (`PSE > 0`), 1-df terms use `F = (|2β| / PSE)²` and two-sided Student t p-value with `df = m / 3`.
- Aliased and excluded terms get `SS = 0` and `p = 1`. Aliased terms get " (Aliased)" appended to their name.
- `effectSummary` contains **all** terms, excluded ones included (flag `isExcluded`). It is sorted by logworth, with aliased terms last.
- Each entry has `name, logworth, pVal, ss, fRatio, df, nparm, isAliased, isExcluded, id`.

### 9. Parameter estimates and VIF

- When `df_error > 0`: `SE = √(MSE·diagInv)`, `t = β/SE`, and p is two-sided from Student t with `df_error`.
- When `df_error = 0` (P0.4 / STAT-5): active 1-df contrasts when `PSE > 0` use `SE = PSE / 2`, `t = β / SE = 2β / PSE` and p from Student t with `df = m / 3`; otherwise (including the intercept and reference rows) `stdError`, `tRatio` and `pVal` are `null`.
- `VIF = diagInv·Σ(x − x̄)²`, floored at 1, and `Infinity` for aliased columns.
- For categorical factors with L ≥ 3, the code adds a reference-level row with estimate `−Σβ`, `SE = √(MSE·1'V1)` when `df_error > 0`, and `null` (never `undefined`) for `stdError`, `tRatio`, `pVal` and `vif` when `df_error = 0`.
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

**Search (`src/core/optimization/optimize.ts`, P0.8):**

- `optimizeFactorBox` evaluates the complete 3-level numeric × categorical Cartesian grid when the grid size is `<= 729` (up to 6 numeric factors).
- When the grid exceeds 729 combinations, it runs a deterministic seeded (`Mulberry32`) Latin-hypercube + anchor start set followed by discrete coordinate search across `{min, mid, max}` and all categorical levels so every factor is searched without lexicographic truncation (fixing STAT-4).
- When `refineContinuous` is true (active quadratic terms exist), it refines numeric settings via bounded step-halving coordinate search.
- Multi-response fitting (`src/core/analysis/projectModels.ts`, P0.6): `fitProjectModels` fits each response with its own saved `excludedTerms` (fixing STAT-7 / UI-3).

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

## Reference tests

`npm test` runs the vitest suite in `tests/` (BLD-4, backlog P2.1 step 1). It compares the engine with fixed reference values in `tests/fixtures/*.json`. Each fixture records where its data and values come from. Its `reference` block is computed by `tests/fixtures/compute_reference.py`: statsmodels 0.14.4 OLS on the estimable columns of the model defined in design spec §4.2, which is what R `lm()` reports with `NA` for aliased terms. R was not installed when the suite was written, so the references are published examples plus statsmodels (open decision 5). Format and rules: [tests/fixtures/README.md](../../../tests/fixtures/README.md).

A test that fails today because of a registered bug is an `it.fails` named after its issue ID and backlog item, so the suite is green and each fix flips exactly its own tests. On 2026-10-21 the suite had 118 passing tests, 38 expected failures and 2 `it.todo`.

"Full comparison" below means every group in `itMatchesReference` (`tests/helpers/reference.ts`): β, SE, t, p, VIF, SSE, R², adjusted R², RMSE, model F, Type III SS/F/p, lack of fit and pure error, leverage (Σh = rank, 0 ≤ h ≤ 1), studentized residuals, Cook's D, adequate precision and the Box-Cox profile. Tolerances are relative 1e-8 (1e-6 for p-values).

| Case (fixture · test file) | Source of data and values | Passes today | Pins known bugs (`it.fails`, flipped by) |
|---|---|---|---|
| Replicated 2^3, plasma etch (`montgomery-ex6-1-plasma-etch` · `replicatedFactorial.test.ts`) | Montgomery (2013) *Design and Analysis of Experiments*, 8th ed., Example 6.1 | Published effects, Type III SS and SST; pure error = published error (8 DF), lack of fit = ABC SS; full comparison | none (baseline) |
| Unreplicated 2^4, filtration (`montgomery-ex6-2-filtration` · `unreplicatedFactorial.test.ts`) | Montgomery Example 6.2, and Lenth's method on it (§6.5) | Published effects; Montgomery's final model A, C, D, AC, AD; full comparison of the default and the final model (the final model's pure error comes from the projection onto A, C, D) | STAT-2 worked example PSE 2.625, ME 6.75, SME 13.70 as `it.todo` (P0.4 adds a core Lenth function) |
| Saturated 2^(4−1), filtration (`montgomery-ex8-1-half-fraction` · `saturated.test.ts`) | Montgomery Example 8.1; Lenth (1989) *Technometrics* 31:469–473 for PSE = 24.75 | Published effects, BC/BD/CD aliased, rank 8, leverages 1 | STAT-2 ×3 (t = \|effect\|/PSE, F = t², pool ignores excluded terms), STAT-5 ×2 (SE 0, zero-width CI/PI), STAT-21 (Box-Cox on an exact fit): P0.4 |
| Saturated 2 × 3 with a 3-level categorical (`factorial-2x3-saturated` · `saturated.test.ts`, `runAnalysis.test.ts`) | Synthetic | Coefficients | STAT-5 (undefined reference row): P0.4. MCP-9 (crash): P0.5 |
| PB12, 6 factors + 3 centre runs (`pb12-6f-3cp` · `rankDeficient.test.ts`) | Plackett & Burman (1946) N = 12 design, the generator's construction; synthetic y with seed | Coefficients, aliased set, fitted values, ANOVA, lack of fit, adequate precision; the explicit reduced model passes the full comparison | STAT-1 ×8 (Σh = rank and h ≤ 1, leverage, SE/t/p, SE = reduced model, VIF, Type III, studentized residuals and Cook's D, Box-Cox): P0.3 |
| DSD, 6 factors + 3 centre runs (`dsd-6f-conference` · `rankDeficient.test.ts`) | Jones & Nachtsheim (2011), from the order-6 conference matrix; synthetic y with seed | Same as PB12 | STAT-1 ×8: P0.3 |
| Regular 2^(4−1) + 3 centre runs (`half-fraction-2x4-1-3cp` · `rankDeficient.test.ts`) | The standard D = ABC fraction (Montgomery §8.2); synthetic y with seed | Full comparison. Its 3 aliased 2FI columns equal other columns exactly, so the engine is right today; this is the control that P0.3 must leave unchanged | none |
| CCD, 2 factors (`montgomery-ex11-2-ccd` · `responseSurface.test.ts`) | Montgomery Example 11.2 (published second-order model and stationary point) | Full comparison of the A, B, A*B fit; linear and interaction coefficients equal the published ones | STAT-3 ×3 (ŷ at the centre = 79.94, ŷ at the stationary point = 80.21, lack of fit not significant) and an `it.todo` for the x² coefficients: P0.9 |
| Optimum, 2^5 and 2^7 (`optimum.test.ts`) | Synthetic with a known answer | 5 factors: F0 at its maximum | STAT-4 ×2 (7 factors): P0.8 |
| Demo project (`demo-suzuki-cross-coupling` · `demoProject.test.ts`) | `src/core/sampleProject.ts` (the fixture copy must stay equal) | Full comparison for Yield and Purity; characterization snapshot of the whole output | none; the snapshot contains known-wrong values (for example `p` = 14) |
| Model p-value (`modelPValue.test.ts`) | Reference fits of Ex. 6.1, Ex. 6.2 and the demo | — | MCP-1/UI-31 ×5 (`dfModel`, `modelPValue`, null when error DF = 0): P0.5 |
| MCP `run_analysis` (`tests/server/mcp/runAnalysis.test.ts`, SDK `InMemoryTransport`) | Demo reference fit | R², adjusted R², RMSE, F | MCP-1, MCP-6, MCP-7, MCP-8, MCP-9: P0.5 |
| Every fixture (`invariants.test.ts`) | — | Predictions at the design points equal the fitted values, also from a JSON-serialised result; coefficients do not depend on factor order (full-rank models) | none |

Not covered yet: design invariants (run counts, level balance, max \|r\|, resolution, D-efficiency) come with P0.11; seeded random rank-deficient 3-level designs with P0.3; the HTML report (UI-31's display side) and the web UI have no tests.

## How to verify numerically

The `.mts` route below is for one-off exploration. Keep such scripts **outside the repo** ([lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)); a check worth keeping becomes a test in `tests/` with a fixture.

1. Write a `.mts` file. It needs top-level `await`, and `tsx` compiles a `.ts` file outside the repo (no `"type": "module"` package.json) as CommonJS, which rejects it.
2. Import the engine through `pathToFileURL('<repo>/src/core/analysis/analysisCore.ts')`.
3. Run it with `<repo>/node_modules/.bin/tsx file.mts`.

The checks below were run on 2026-10-20 and give the results shown. They are now `it.fails` tests ([Reference tests](#reference-tests)). The fixtures use their own Y data, so values that depend on Y differ; leverage depends only on the design, and the PB12 fixture reproduces Σh = 11.000 and max h = 1.067. The STAT-5 and STAT-4 runs used different Y data from the registry's runs, so their CI and desirability values differ from the registry and backlog figures (CI [15.28, 15.28]; desirability 0.045); the failure pattern is the same.

| Check | Setup | Invariant | Current result |
|---|---|---|---|
| STAT-1 | `generateDesign(6 numeric, 'plackett_burman', {centerPoints: 3})`, any Y, `excludedTerms = []` | `Σ studentizedResiduals[i].leverage == rank` (`rank = p + 1`), every `h ≤ 1` | rank 12, `df_error` 3, Σh = 11.000, max h = 1.067 |
| STAT-2 | Regular 2^(4−1) (D = ABC), 8 runs, default model, `df_error = 0` | Plotted `paretoData.tRatio` equals the Lenth t, `|2β|/PSE` over the 7 estimable contrasts | ratio = 2.000 = n/4 |
| STAT-5 | Same design | Parameter-estimate SE > 0 or "not estimable"; CI width > 0 | SE 0, t 0, p 1; optimum CI `[25.000, 25.000]` |
| STAT-21 | Same design | Box-Cox `null` when SSE ≈ 0 | `optimalLambda = −2`, "Inverse (1/Y)" |
| STAT-4 | 2^k full factorial, Y = 10 ± 5 on F0 (+0.1 on other factors), maximize | Optimum F0 = max | k = 5: F0 = 100 (correct); k = 7: F0 = 0, desirability 0.10 |

Reference values for fixes:

- compare against a reduced full-rank model fitted on the estimable columns (STAT-1; `rankDeficient.test.ts` does);
- Lenth (1989), *Technometrics* 31:469-473 (STAT-2; the Ex. 6.2 and Ex. 8.1 fixtures carry the values);
- JMP or R `lm` and `anova` for every table, starting with the demo project (statsmodels stands in until decision 5 is made).

AGENTS.md requires a reference test before any statistics change. Add it to `tests/` with a fixture.
