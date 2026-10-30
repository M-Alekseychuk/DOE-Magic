# DOE-Magic — Status and Handoff (START HERE)

> Created: 2026-10-20. Status: START HERE. Current as of 2026-10-21. First written for PR `chore/project-structure-and-core-docs` (PR #1), which was merged on 2026-10-21: do the after-merge steps below if not done yet. Updated for the owner's commit cc41f15 and decision 1 (no lockfile, PR #4), [below](#since-pr-1-commit-cc41f15-and-decision-1), the P0.1 fix (demo buttons, PR #2) and the test harness (backlog P2.1 step 1, PR #3).
> Related: [Goals](goals.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [README](../../../README.md), [AGENTS.md](../../../AGENTS.md)

## First screen: what you must know

- **Never push from an AI Studio workspace older than `main`.** PR #1 was merged on 2026-10-21. The first AI Studio push after it, cc41f15, came from a workspace that matched `main`, but it still deleted three files without saying so ([below](#since-pr-1-commit-cc41f15-and-decision-1)). Read the file list of every AI Studio commit.
- **The app works and runs, but several results are wrong.** Do not use the outputs in [Top risks](#top-risks-right-now) for process decisions, batch records or reports until they are fixed. `npm test` now compares the statistics engine with published textbook examples and with statsmodels reference fits, and pins the known wrong outputs as expected failures ([Reference tests](../../context/DOE-Magic/statistics-engine.md#reference-tests)). No comparison against JMP or R is recorded yet (decision 5).
- **Some buttons delete data without asking.** "Generate Design Matrix", Excel import and "Simulate Sample Data" overwrite measured results. Export each project as JSON before you touch them (the Dashboard can import that file again as a copy). Since P0.1, "Demo Studies" / "Load Demo Experiments" only add a copy of the demo study; the full reset is "Reset Sample Data" in the Archive view, which asks first and makes the server copy `data.json` aside.
- **If you use Google AI Studio:** first export every real project with **Export JSON** on its page; a new AI Studio project starts with only the demo project, and the browser's copy is not a backup. After every merge, re-import the project from `main` (or start a fresh AI Studio project from `main`) before you edit again, then bring each project back with **Import Project** on the Dashboard. Otherwise AI Studio's sync will push its old copy over this work. Nobody has confirmed the exact AI Studio steps yet ([AI Studio origin §6](../../context/DOE-Magic/ai-studio-origin.md#6-sync-overwrite-risk-and-the-safe-workflow-after-this-pr)). See [AI Studio warning](#ai-studio-warning).
- **There is no login.** Anyone who can open the app's address can read and delete all data, and so can any other website open in the same browser (SRV-1). If the app was shared or deployed from AI Studio, anyone with the link can too. Run it only on your own machine or a trusted network.

## Current state (2026-10-20)

DOE Magic is a working Design-of-Experiments web app with an MCP server. M-Alekseychuk built it in Google AI Studio for Jiuzhou Pharmaceutical process scientists. It plans designs (factorial, DSD, CCD, BBD, Plackett-Burman, D-optimal), analyses results (OLS, ANOVA, effects, diagnostics, desirability), compares responses, runs Monte Carlo robustness and Bayesian next-run suggestions, and exports JSON, Excel and HTML. It works in English and Chinese.

PR #1 reorganised the repository and documented it without changing any behaviour. PR #3 added the test harness (below); it changes no calculation either. A review of the code (some of it confirmed by running the engine) registered 160 issue IDs: 14 Critical, listed below, 47 High, 63 Medium and 36 Low. SRV-14 (Low) was added on 2026-10-21, so the registry now holds 161. Some IDs describe the same bug from two angles. All of them are recorded in the [backlog](../../spec/DOE-Magic/roadmap-backlog.md). Since PR #1, DATA-1 and UI-1 are fixed (P0.1, PR #2, see [Changes after the merge](#changes-after-the-merge)), and the owner's commit cc41f15 fixed the port part of SRV-8 and part of SRV-10; none of the others are. The next work is Phase 1 of the [goals](goals.md): tests plus statistical correctness.

## Test harness (backlog P2.1 step 1, PR #3)

Tests and tooling only; nothing under `src/` changed.

| Change | Where |
|---|---|
| vitest ^4.1.11 as a devDependency and `npm test` (`vitest run`); Node environment, separate from `vite.config.ts` | `package.json`, `vitest.config.ts` |
| `tests/` (mirrors `src/`) is type-checked by `npm run check` and allowed at the repo root by R9; the checker's self-test has a case for it (29 cases) | `tsconfig.json`, `scripts/check-boundaries.mjs`, `scripts/check-boundaries.test.mjs` |
| 9 reference fixtures with their provenance: Montgomery (2013) Examples 6.1, 6.2, 8.1 and 11.2, PB12 and DSD screening designs, a regular 2^(4−1) with centre runs, a saturated 2 × 3 factorial and the demo project | `tests/fixtures/*.json` |
| The reference script: statsmodels OLS on the documented model, because R was not installed | `tests/fixtures/compute_reference.py` |
| Tests for the engine and MCP `run_analysis`: reference comparisons, invariants, a characterization snapshot of the demo project, and 38 expected failures named after STAT-1, STAT-2, STAT-3, STAT-4, STAT-5, STAT-21, MCP-1/UI-31, MCP-6, MCP-7, MCP-8 and MCP-9 | `tests/core/analysis/`, `tests/server/mcp/`, `tests/helpers/` |

The case table (which fixture, which source, which issue IDs, which backlog item flips each test) is in the [statistics engine doc](../../context/DOE-Magic/statistics-engine.md#reference-tests). A new finding while writing the fixtures: on the PB12 fixture STAT-1 gives two estimable terms (the main effect `Offset` and `Temperature*Loading`) an SE of 0, so t 0 and p 1; it is recorded under P0.3 in the backlog.

**How it was verified (2026-10-21, Node 24.13.0)**

| Check | Result |
|---|---|
| `npm test` | 10 files: 118 passed, 38 expected failures, 2 todo |
| Every `it.fails` run as a plain `it` | Each fails on an assertion about its documented value (for example MCP `summary.pValue` 14 instead of 1.09e-12; Pareto t 1.535 instead of the Lenth t 0.768; Σ leverage 11 instead of 12) |
| `npm run check` | `tsc` 0 errors; `Layer boundaries OK: 35 files, 8 reachable from the Node entry points.` |
| `node scripts/check-boundaries.test.mjs` | All 29 cases pass |
| `npm run build` | `dist/` is byte-identical to a build of `main` (cc41f15) with the same `node_modules`. With the lockfile gone, the dependencies resolved newer (for example Vite 6.4.5 instead of 6.4.3), so the main bundle is 2,033,476 bytes instead of PR #1's 2,002,786; with PR #1's lockfile this branch built byte-identical to PR #1 |
| Lockfiles | None updated. Commit cc41f15 on `main` deleted `package-lock.json` and `bun.lock` just before this PR (backlog, [Unregistered findings](../../spec/DOE-Magic/roadmap-backlog.md#unregistered-findings-awaiting-ids)), so the checks above ran after a fresh `npm install --no-package-lock`. `npm ci` needs a lockfile again (decision 1) |

## What the restructuring PR changed

All commits sit on top of `origin/main` `0d05f8c`.

| Commit | Change |
|---|---|
| `b8dc9f6` | Removed 201 dead one-off patch/debug scripts and text dumps from the repo root. None were referenced. `fix_html_full.mjs`/`.py` and `make_export.mjs` would have overwritten the export with an older version if re-run. ([lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)) |
| `64eed78` | Stopped tracking `data.json`, the runtime store, and added it to `.gitignore`. When it is missing, the server seeds its store from the sample project and folder ([`server.ts:36-56`](../../../server.ts)) and writes the file on the first save. ([lesson](../../memory/DOE-Magic/runtime-data-in-git.md)) |
| `50c088c` | Synced `package-lock.json`, which lacked `@modelcontextprotocol/sdk`, `zod` and `remark-gfm`, so `npm ci` failed. `bun.lock` already matched. Both lockfiles were kept then; cc41f15 later deleted both, and decision 1 now tracks none. ([lesson](../../memory/DOE-Magic/lockfile-drift.md)) |
| `95fce20` | Reorganised `src/` into `core/`, `server/` and `web/` (34 renames). Only file moves, import strings and the `mcp` script path changed, plus a `tsconfig.json` include/exclude list, the path in the `.gitignore` comment about `data.json`, and deletion of the unreferenced `src/assets/images/jiuzhou_logo_*.jpg`; no logic. Line numbers inside moved files did not change. |
| `818b8db` | Limited Tailwind class scanning to `src/` (`source("..")` in [`src/web/index.css`](../../../src/web/index.css)). CSS went from 118.5 kB after the cleanup (126.2 kB before it, when the junk scripts were scanned too) to 116.4 kB. No class used by `src/` was removed. ([lesson](../../memory/DOE-Magic/tailwind-scans-whole-repo.md)) |
| `2a55744` | Added `npm run check` = `tsc --noEmit` + [`scripts/check-boundaries.mjs`](../../../scripts/check-boundaries.mjs), which enforced the layer rules (R1 to R8) ([design spec](../../spec/DOE-Magic/design-spec.md)). |
| `ea8091e` | Added rule R9 to the checker: git may track only the agreed entries at the repo root, so a committed scratch script fails `npm run check`; skipped with a warning when git is unavailable. `.gitignore` now ignores `.aistudio/`. The check now enforces R1–R9. ([lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)) |
| `bd786d9` | Anchored that ignore to the repo root (`/.aistudio/`), so it no longer also matches the template's `assets/.aistudio/`. |
| `03f1ba0` | Rewrote the boundary checker on the TypeScript compiler API (`typescript` is already a devDependency, so the check now needs `node_modules`). Imports are read with `ts.preProcessFile`, so commented-out code and import-like strings no longer count; browser globals are found on the syntax tree. `src/main.tsx` now counts as browser code and `server.ts` as server code; `.js`/`.jsx`/`.mjs`/`.cjs` files are scanned; loose files directly in `src/web/features/` fail R6; R1 ignores dotfiles; R9 allows `.github/` and `LICENSE` and reports a tracked `.aistudio/` or `data.json` as re-added by an AI Studio sync. |
| `534ec68` | Added the checker's self-test, `scripts/check-boundaries.test.mjs` (28 cases). |
| the docs commit | Adds `README.md`, `AGENTS.md`, `CLAUDE.md` and this `docs/` set. |

**How it was verified**

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors before and after |
| `npm run check` (re-run 2026-10-20 after 03f1ba0) | `Layer boundaries OK: 35 files, 8 reachable from the Node entry points.` |
| `vite build` + esbuild server bundle | Builds. Main JS bundle is 2,002,786 bytes before and after (identical size). |
| `node --no-experimental-require-module dist/server.cjs` (Node without `require(esm)`) | Fails with `ERR_REQUIRE_ESM` on `uuid`, so the production bundle needs Node ≥ 22.12 (or ≥ 20.19) (SRV-6/BLD-13) |
| `node scripts/check-boundaries.test.mjs` | All 28 cases pass. 21 injected violations covering R1–R9 each make the check fail. 7 former false positives (for example commented-out imports and import-like strings) pass. |
| Behavioural smoke snapshot (lead) | Identical before and after, apart from bundle hashes and module paths. It covered the production server's REST API, MCP over HTTP including `run_analysis` on the demo project, stdio MCP, and dev-mode Vite loading all 31 modules. |

Known bugs are still present: the PR fixes none of them, by design.

## Changes after the merge

| Item | Change |
|---|---|
| P0.1 (DATA-1, UI-1), 2026-10-21 | "Demo Studies" and "Load Demo Experiments" add a fresh copy of the demo study and open it; they never replace a project. The full reset moved to "Reset Sample Data" in the Archive view, behind the new shared `ConfirmDialog`. `POST /api/reset-sample` now needs the JSON body `{"confirm": true}` (400 and no change otherwise) and copies `data.json` to `data.json.before-reset-<timestamp>` first. Verified by running the dev server and the production bundle; details in the [backlog](../../spec/DOE-Magic/roadmap-backlog.md#p01-outcome). |
| P0.3 (STAT-1), P0.4 (STAT-2, STAT-5, STAT-21), P0.9 (STAT-3, DES-4) | Replaced the Gauss-Jordan `(X'X)⁻¹` solver with a two-pass Gram-Schmidt QR solver on `X` (`src/core/analysis/linalg.ts`); fixed Lenth's method (`computeLenth`) and zero-DF saturated-model inference (`null` intervals and reference rows, `boxCox = null` when `dfError < 2` or `sse <= 1e-12`); added quadratic terms (`${f.id}^2`, displayed as `${f.name}*${f.name}`) for response-surface designs (`src/core/analysis/modelSpec.ts`) and 3+-level D-optimal candidate selection (`src/core/design/dOptimal.ts`). All 26 pinned `it.fails` tests and 2 `it.todo` tests for STAT-1, STAT-2, STAT-3, STAT-5 and STAT-21 now pass. |
| P0.6 (STAT-7, UI-3), P0.8 (STAT-4, MCP-11), P0.11 (DES-2, UI-14, DES-10, DES-17), P0.12 (DES-3) | Added `fitProjectModels` (`src/core/analysis/projectModels.ts`) so the Prediction Profiler, Compare, Robustness, Excel export and MCP fit each response with its own saved `excludedTerms`; replaced the 512-truncated optimum grid with `optimizeFactorBox` and `buildCompleteSearchCandidates` (`src/core/optimization/optimize.ts`); implemented minimum-aberration regular $2^{k-p}$ fractional factorials (`src/core/design/fractions.ts`) and corrected `designMatrixData.ts`; implemented conference-matrix Definitive Screening Designs (`src/core/design/dsd.ts`) per Jones & Nachtsheim (2011, 2013) and Xiao, Lin & Bai (2012). |
| P0.2 (DES-1, UI-2, MCP-10), P0.5 (MCP-1, UI-31, STAT-12, MCP-6, MCP-7, MCP-8, MCP-9), P0.7 (MCP-2), P0.10 (STAT-8, UI-4) | Added `dfModel` and `modelPValue` ($1 - F_{\text{cdf}}(F; \text{dfModel}, \text{dfError})$, or `null` when $\text{dfError} = 0$) and exported `AnalysisResult` in `src/core/analysis/analysisCore.ts`; added `resolveExcludedTerms` in `src/core/analysis/modelSpec.ts` and updated MCP `run_analysis` and HTML export (`UI-31`); removed the `[0.9·min, 1.1·max]` sample clamp in MCP `simulate_robustness`; added `surfaceGrid` / `buildProjectSurfaceGrids` (`src/core/analysis/surfaceGrid.ts`) so HTML export surfaces and contours use `predictModelResponse` instead of `predictSurrogate`; added `ConfirmDialog` prompts before overwriting measured runs in `ProjectDesign.tsx`, non-destructive empty-cell-only `simulateSampleDataForResponse` in `ProjectAnalysis.tsx`, and `force` protection + `centerPoints ?? 3` in MCP `generate_doe_design`. All 38 originally pinned `it.fails` tests now pass as `it(...)`. |
| P1.11 (STAT-11, STAT-14, STAT-26), P1.18 (DES-5, MCP-13), P1.19 (DES-7), P1.20 (DES-6, DES-19, DES-20, DES-21), P1.21 (STAT-10, UI-10), P1.4 (UI-11), P1.14 (MCP-4) | Added `validateRuns` (`src/core/analysis/modelSpec.ts`) to exclude and report runs with invalid numeric factors, unknown categorical levels, or malformed response strings (`'12.5a'`) and removed the `[-2, 2]` coded-value clamp in `getFactorContrasts`; replaced heuristic D-efficiency with exact $100 \cdot \|X'X\|^{1/p} / N$ (`computeDEfficiency` in `src/core/design/dOptimal.ts`, returning `null` when singular) and fixed the $100\times$ MCP/generator multiplication bug; added pure seeded Fisher-Yates `randomize(runs, seed)` (`src/core/design/randomize.ts`) and `Project.randomSeed`; added `buildCenterPointRuns` and `buildAxialPointRuns` (`src/core/design/centerPoints.ts`) so `centerPoints: 0` is honoured everywhere, categorical centre points are distributed across levels, all-categorical designs emit 0 centre points with a warning, and empty `levels` never write `undefined`; fixed target-0 fallback (`buildOptimizationOptions` in `src/core/optimization/optimize.ts` and `ProjectOptimization.tsx`); escaped all HTML export interpolations and built category buttons/select options with DOM APIs (`htmlExport.ts`); enforced exact project/response matching and archive-first deletion in MCP write tools (`doeMcpServer.ts`). |

## Since PR #1: commit cc41f15 and decision 1

The owner's commit cc41f15 ("build: configure server port and HMR settings", 2026-10-21 10:26 +0200, 13 minutes after PR #1 merged) is an AI Studio push. It changes only 6 files, so it came from a workspace that matched `main`. It:

- reads the port from `PORT`, default 3000 (`server.ts:8`);
- passes `hmr: false` to Vite when `DISABLE_HMR=true`, instead of the inline HMR object (`server.ts:373`);
- rewrites `.env.example` (empty `GEMINI_API_KEY` and `APP_URL`, a new `PORT=3000`, shorter comments) and adds a duplicate `node_modules` line to `.gitignore`;
- deletes `package-lock.json`, `bun.lock` and `assets/.aistudio/.gitignore`; the commit message mentions none of these deletions.

Decision 1 was settled on 2026-10-21 (PR #4): **no lockfile for now.** A restored lockfile would be deleted again by the next AI Studio push, and early development accepts floating versions. Both lockfiles are in `.gitignore`. Install with `npm install`; `npm ci` needs a lockfile. Why, the cost, and when to revisit: [lockfile lesson](../../memory/DOE-Magic/lockfile-drift.md). Whether `assets/.aistudio/.gitignore` comes back is the owner's call.

Running the dev server (2026-10-21, Node 24.13.0, Vite 6.4.5) showed:

| Started with | Listens on | HMR port in `/@vite/client` | `vite-hmr` WebSocket |
|---|---|---|---|
| no `PORT` | 3000 | 3000 | opens on 3000 |
| `PORT=3100` | 3100 | 3000 | opens on 3100, but the client dials 3000 (new: SRV-14) |
| `PORT=abc` | 3000 | 3000 | opens on 3000 |
| `PORT=3101 DISABLE_HMR=true` | 3101 | 24678 | none on 3101; Vite opens its own WebSocket server on 24678 instead (SRV-10, still open) |

Checks on this state, after `npm install` without a lockfile: `npm run check` prints `Layer boundaries OK: 35 files, 8 reachable from the Node entry points.`; `node scripts/check-boundaries.test.mjs` passes all cases; `npm run build` succeeds. Vite resolved to 6.4.5, where PR #1's lockfile had 6.4.3, and the main bundle is 2,033,476 bytes instead of 2,002,786, with no client code change: this is the cost of floating versions.

## Repository map

```text
server.ts           Node entry: Express REST, socket.io sync, data.json store, MCP over HTTP/SSE, Vite/static serving
index.html          Browser entry: loads /plotly.min.js (Plotly 3.7.0) and /src/main.tsx
src/main.tsx        React entry (stays here for AI Studio)
src/core/           Pure TypeScript for browser and Node: types.ts, sampleProject.ts, analysis/analysisCore.ts, design/
src/server/mcp/     Node only: doeMcpServer.ts (11 tools, 3 resources, 2 prompts), stdio.ts (npm run mcp)
src/web/            Browser only: App, Layout, state/ProjectContext (save/sync), i18n/, shared/, pages/
src/web/features/   One folder per feature: the six tabs (setup, design, analysis, compare, robustness, optimization) plus export and mcp-panel
public/             logo.png, plotly.min.js (served as-is)
scripts/            check-boundaries.mjs (rules R1–R9)
tests/              vitest suite: core/analysis, server/mcp, helpers, fixtures (reference data and compute_reference.py)
docs/               task / spec / context / memory docs (index below)
```

## How to run

Run every command from the repository root. `data.json` is created in the current working directory (SRV-8).

| Command | What it does |
|---|---|
| `npm install` | Install dependencies. No lockfile is tracked (decision 1), so versions resolve within the `package.json` ranges on the day you install |
| `npm run dev` | Start the development server on http://localhost:3000. `PORT` picks another port ([`server.ts:8`](../../../server.ts)), but hot reload then dials 3000 and stops working (SRV-14) |
| `npm run check` | Type-check and run the layer rules. Must pass before every commit. |
| `npm test` | Run the test suite in `tests/` (vitest). Must pass before every commit. Known bugs show as expected failures |
| `npm run build` | Build the client into `dist/` and the server into `dist/server.cjs` |
| `NODE_ENV=production npm start` | Run the build. Without `NODE_ENV=production` it runs Vite dev middleware (SRV-3/BLD-1). In PowerShell: `$env:NODE_ENV="production"; npm start`. That leaves `NODE_ENV` set for the window, so a later `npm run dev` there serves the old `dist/`; close the window afterwards or run `Remove-Item Env:NODE_ENV`. |
| `npm run mcp` | Start the stdio MCP server for desktop AI clients. The config snippet shown in the app's MCP panel does not work as given (MCP-18); see [MCP server](../../context/DOE-Magic/mcp-server.md). |
| `npm run lint` | `tsc --noEmit` only |

- Remote MCP endpoints: `POST /mcp` (a hand-written JSON-RPC dispatcher, MCP-5/MCP-17) and `GET /mcp/sse` (SSE), each also under `/api/`. The SSE stream's `endpoint` event always tells the client to post messages to `POST /api/mcp/messages` ([`server.ts:252`](../../../server.ts)).
- Data: the server keeps everything in `data.json` in the directory it was started from, and each browser keeps a cache in localStorage, which the server's data overwrites on every load, so it is not a backup. There are no automatic backups (DATA-2, DATA-16), except the copy `data.json.before-reset-<timestamp>` that a confirmed "Reset Sample Data" writes next to `data.json`. To back up, copy `data.json` while the server is stopped, or export each project as JSON. Do not run `npm run mcp` while the web server uses the same `data.json` (DATA-3). Details: [Server and persistence](../../context/DOE-Magic/server-and-persistence.md).
- Connecting an AI client (Claude Desktop over stdio, or SSE at `http://localhost:3000/mcp/sse`): see [MCP server: connecting a client](../../context/DOE-Magic/mcp-server.md#connecting-a-client).
- Verified on Node 24.13.0. The production bundle `require()`s the ESM-only `uuid` package, so it needs Node 22.12 or newer (or 20.19 or newer on the 20.x line), where `require(esm)` is on by default. Confirmed by running: `node --no-experimental-require-module dist/server.cjs`, which simulates an older Node, fails with `ERR_REQUIRE_ESM` (SRV-6/BLD-13).

## Top risks right now

**Until these are fixed, do not trust the affected results.** That covers in particular:
- "DSD" designs
- the resolution shown for fractional factorials
- p-values and significance on screening designs
- the optimum when there are many factors
- MCP `run_analysis` `pValue`, the HTML report's "Model p-value" card (UI-31) and MCP robustness numbers

The Critical issues:

| ID | What goes wrong | What not to trust or do |
|---|---|---|
| STAT-1 | When the model has more terms than the design can estimate (the default for Plackett-Burman, DSD and D-optimal), (X'X)⁻¹ is wrong. Standard errors were understated up to 2.45× in a test. The coefficients themselves are correct. | SE, p-values, VIF, leverage, Cook's D, intervals and Box-Cox on those designs |
| STAT-2 | Lenth's pseudo-error is scaled wrongly. On unreplicated, saturated models t is inflated by n/4 (2× for 8 runs, 4× for 16), so almost everything looks significant. | Pareto, half-normal and effect-test significance on unreplicated screening designs |
| STAT-3 | The analysis model never contains squared terms, so CCD, BBD and DSD data are fitted without curvature. | Any response-surface conclusion: surfaces, profiler, optimum, robustness |
| STAT-4 | The optimum search builds a 3-level grid per numeric factor and keeps only the first 512 combinations after each factor. With 6 or more numeric factors the reported optimum can be wrong; in a test with 7 factors, a factor that should be maximised was reported at its minimum. | "Optimal conditions" with 6+ factors. Also MCP `optimize_desirability` with 6+ factors at the default grid, or fewer at a finer grid (MCP-11). |
| DES-1, UI-2 | "Generate Design Matrix" and Excel import replace all runs, including measured results, without asking. "Simulate Sample Data" writes invented values over real ones and does not mark them. MCP `generate_doe_design` behaves the same (MCP-10). | Do not use these on a project with data. Export JSON first. |
| DES-2 | The "fractional factorial" is a D-optimal subset, not a regular fraction. Example: 4 factors in 8 runs is shown as Res IV, but one main effect is fully aliased with a two-factor interaction (Res III). | Resolution labels and aliasing assumptions |
| DES-3 | "Definitive Screening Design" is not a DSD. Main effects are correlated (\|r\| up to 0.67, 0.80 and 0.86 for 4, 6 and 8 factors). | DSD designs and the screening conclusions drawn from them |
| MCP-1 | MCP `run_analysis` reports the model's degrees of freedom as `summary.pValue` (for example 14). The HTML report prints the same number as "Model p-value" (UI-31, High, fixed together). | The MCP model p-value, the report's "Model p-value", and any conclusion based on them |
| MCP-2 | MCP `simulate_robustness` clamps samples to [0.9·min, 1.1·max]. That is wrong for zero or negative ranges and cuts the tails. | MCP Cpk, PPM and pass rate |
| UI-3 (= STAT-7) | In multi-response projects, the Prediction Profiler fits every response except the selected one with the full model and ignores its excluded terms. | Profiler predictions and global desirability for the other responses |
| UI-4 (= STAT-8) | The HTML export draws response surfaces from the intercept plus numeric main effects only. Interactions and categorical terms are dropped. | Surface and contour plots in exported reports |

Fixed since the review: DATA-1 and UI-1, the demo buttons that replaced every project for every user (P0.1, 2026-10-21).

Other high-impact risks:
- SRV-1: no authentication, CORS open to every origin, and the server listens on 0.0.0.0.
- DATA-2: a crash mid-write can corrupt `data.json`. The next start then re-seeds and overwrites it.
- DATA-3: the stdio MCP and the web server overwrite each other's `data.json`.
- DATA-4: last writer wins between tabs and agents.
- SRV-2/BLD-2: a production build serves `server.cjs.map`, which contains the server source.

## Immediate next steps

1. **Done 2026-10-21: PR #1 is merged.** If you run the app from a local folder, copy `data.json` aside before you pull: the file is no longer tracked, so git either deletes it on pull or, if it has local changes, refuses to pull until you move it away.
2. **Owner: bring your real projects back, if not done yet.** cc41f15 shows that the AI Studio workspace now matches `main`. If you exported projects before switching, bring each one back with **Import Project** on the Dashboard. The exact AI Studio steps are unverified (see [AI Studio warning](#ai-studio-warning)).
3. **Answer the open decisions below.** The owner answers decisions 3, 4, 5 and 6 in plain words; a developer settles decisions 2, 7 and 8. Decision 1 is settled.
4. **Follow the "suggested PR sequence" in the [roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md).** It is the authoritative order. In outline:
   - guard the remaining one-click data-loss buttons (P0.2; the demo buttons are done, P0.1)
   - tests are in (P2.1 step 1); next comes CI that runs `npm install`, `npm run check`, `npm test` and `npm run build` (P2.1 step 2). No lockfile is tracked (decision 1), so CI installs with `npm install`
   - fix the Critical statistics and design issues, one PR each. Each fix changes its own `it.fails` tests to `it` (for example P0.3 flips the 16 STAT-1 tests) and adds fixtures where the [case table](../../context/DOE-Magic/statistics-engine.md#reference-tests) has gaps

   Each PR is either move-only or a logic change, never both.

## Open decisions

| # | Decision | Who answers | Why it matters | IDs |
|---|---|---|---|---|
| 1 | Keep `bun.lock` or `package-lock.json`? **Settled 2026-10-21: neither, for now.** npm without a lockfile; both files are in `.gitignore`. | Developer | cc41f15 (an AI Studio push) deleted both, and the next push would delete a restored one. The cost: two installs can resolve different versions. Revisit when AI Studio stops pushing to `main` or a dependency update changes a test result ([lesson](../../memory/DOE-Magic/lockfile-drift.md)). | BLD-7 |
| 2 | Remove the Gemini leftovers: `@google/genai`, the `metadata.json` Gemini capability, and `GEMINI_API_KEY` in `.env.example`? | Developer | They suggest data goes to Gemini, which it does not. The effect on AI Studio is unverified. | BLD-10, SRV-11 |
| 3 | Where does the app really run: local only, on a LAN, or deployed from AI Studio (Cloud Run)? Unverified. | Owner | This sets the priority of auth (SRV-1) and durable storage (DATA-9). | SRV-1, DATA-9 |
| 4 | Keep editing in AI Studio after the merge, or move to local development with PRs? | Owner | AI Studio sync overwrites the repo with its own workspace. | see [lesson](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md) |
| 5 | Which reference software defines "correct": JMP, R, or published examples? Is JMP available? | Owner | Phase 1 tests need fixed reference values. Until decided, the tests use published examples plus statsmodels (R was not installed). | BLD-4 |
| 6 | Does the tool fall under GMP or data-integrity rules? | Owner | This decides how far Phase 3 goes (audit trail, identity, backups). | DATA-16 |
| 7 | Move the server bundle out of `dist/`? It is a path AI Studio is sensitive to. | Developer | Needed to stop serving the source map. | SRV-2, BLD-2 |
| 8 | Which authentication model: none with localhost-only binding, a shared token, reverse-proxy SSO, or per-user accounts? | Developer | Decides the auth part of the server lock-down and whether changes can record who made them. | SRV-1, DATA-16 |

Options, blocked items and interim defaults for each decision are in the [backlog](../../spec/DOE-Magic/roadmap-backlog.md#open-decisions-for-the-owner).

## AI Studio warning

When AI Studio syncs to GitHub, it pushes its *whole* workspace snapshot. Commit `ef15736` (M-Alekseychuk, 2026-10-19) deleted the original `README.md` that way. If an AI Studio workspace older than this branch pushes after the merge, it can undo the reorganisation, re-add the deleted scripts or drop these docs.

**Before switching, export every real project with Export JSON. After every merge, re-import the AI Studio project from `main`, or start a fresh one from it, before any further AI Studio edits, then bring the projects back with Import Project.** A new or re-imported workspace has no `data.json`, so the server starts with only the demo project, and the browser cache is overwritten by the server's data on load. The exact AI Studio steps are unverified.

AI Studio's sync may ignore `.gitignore`: it committed `assets/.aistudio/.gitignore` and `data.json` in `ef15736`. `.gitignore` only keeps files out of commits made with git. If a sync re-adds `.aistudio/` or `data.json`, `npm run check` fails R9 with a message saying so. A sync also deletes files: cc41f15 came from a workspace that matched `main` and still dropped both lockfiles and `assets/.aistudio/.gitignore`.

Root files that AI Studio needs stay in place: `server.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `metadata.json`, `.env.example`, `public/` and `src/main.tsx`; also `assets/.aistudio/` if the owner restores it (cc41f15 deleted its only file). Details: [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [lesson](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md).

## Doc index

| Doc | Purpose |
|---|---|
| [README](../../../README.md) | For the owner and anyone running the app: what it is, how to run it, where things are |
| [AGENTS.md](../../../AGENTS.md) / [CLAUDE.md](../../../CLAUDE.md) | Entry point and rules for AI coding agents |
| **task/** | |
| [Goals](goals.md) | Vision, users, scope, principles, phased roadmap with success criteria |
| [Status and handoff](status-and-handoff.md) | This page: current state, risks, next steps |
| **spec/** | |
| [Design spec](../../spec/DOE-Magic/design-spec.md) | Architecture contract: layers, rules R1–R9, where new code goes |
| [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md) | Issue registry (STAT, DES, MCP, SRV, DATA, UI, I18N, BLD) and the suggested PR sequence |
| **context/** | |
| [Statistics engine](../../context/DOE-Magic/statistics-engine.md) | How `analysisCore.ts` fits, tests and predicts; known issues; the reference-test case table |
| [Design generation](../../context/DOE-Magic/design-generation.md) | Design types, the two generators, D-optimal; known issues |
| [MCP server](../../context/DOE-Magic/mcp-server.md) | Tools, resources, prompts, transports, client configuration |
| [Server and persistence](../../context/DOE-Magic/server-and-persistence.md) | `server.ts`, REST, socket.io, `data.json`, browser cache |
| [Web UI](../../context/DOE-Magic/web-ui.md) | Pages, tabs, state, i18n, exports |
| [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md) | How the project came from AI Studio and how to keep it compatible |
| **tests/** | |
| [Fixtures README](../../../tests/fixtures/README.md) | Fixture format, provenance rules, recomputing reference values, flipping `it.fails` tests |
| **memory/** | Lessons: mistake → root cause → prevention |
| [Patch scripts in repo root](../../memory/DOE-Magic/patch-scripts-in-repo-root.md) | 201 throwaway scripts piled up at the root |
| [Forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md) | Copies of calculations that diverged |
| [Runtime data in git](../../memory/DOE-Magic/runtime-data-in-git.md) | `data.json` was tracked although the server rewrites it |
| [Lockfile drift](../../memory/DOE-Magic/lockfile-drift.md) | `package-lock.json` fell behind `bun.lock`; later an AI Studio push deleted both, and decision 1 now keeps none |
| [Tailwind scans whole repo](../../memory/DOE-Magic/tailwind-scans-whole-repo.md) | Non-source files became CSS |
| [Windows long paths](../../memory/DOE-Magic/windows-long-paths.md) | Path-length limits on Windows broke clone, `npm install` and a `git init` in a temp folder; keep every working copy on a short path |
| [AI Studio sync overwrites repo](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md) | AI Studio pushes its whole workspace |
| [Demo button wiped all data](../../memory/DOE-Magic/demo-button-wiped-all-data.md) | A "load demo" button ran a reset that deleted every user's projects |
