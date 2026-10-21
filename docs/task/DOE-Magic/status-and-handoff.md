# DOE-Magic — Status and Handoff (START HERE)

> Created: 2026-10-20. Status: START HERE. Current as of 2026-10-21. First written for PR `chore/project-structure-and-core-docs` (PR #1), which was merged on 2026-10-21: do the after-merge steps below if not done yet. Updated for the test harness PR (backlog P2.1 step 1, PR #PRNUM).
> Related: [Goals](goals.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [README](../../../README.md), [AGENTS.md](../../../AGENTS.md)

## First screen: what you must know

- **Until the PR is merged, do not push from AI Studio.**
- **The app works and runs, but several results are wrong.** Do not use the outputs in [Top risks](#top-risks-right-now) for process decisions, batch records or reports until they are fixed. `npm test` now compares the statistics engine with published textbook examples and with statsmodels reference fits, and pins the known wrong outputs as expected failures ([Reference tests](../../context/DOE-Magic/statistics-engine.md#reference-tests)). No comparison against JMP or R is recorded yet (decision 5).
- **Some buttons delete data without asking.** "Demo Studies" / "Load Demo Experiments" on the dashboard replace *all* projects for everyone. "Generate Design Matrix", Excel import and "Simulate Sample Data" overwrite measured results. Export each project as JSON before you touch them (the Dashboard can import that file again as a copy).
- **If you use Google AI Studio:** first export every real project with **Export JSON** on its page; a new AI Studio project starts with only the demo project, and the browser's copy is not a backup. After the merge, re-import the project from `main` (or start a fresh AI Studio project from `main`) before you edit again, then bring each project back with **Import Project** on the Dashboard. Otherwise AI Studio's sync will push its old copy over this work. Nobody has confirmed the exact AI Studio steps yet ([AI Studio origin §6](../../context/DOE-Magic/ai-studio-origin.md#6-sync-overwrite-risk-and-the-safe-workflow-after-this-pr)). See [AI Studio warning](#ai-studio-warning).
- **There is no login.** Anyone who can open the app's address can read and delete all data, and so can any other website open in the same browser (SRV-1). If the app was shared or deployed from AI Studio, anyone with the link can too. Run it only on your own machine or a trusted network.

## Current state (2026-10-20)

DOE Magic is a working Design-of-Experiments web app with an MCP server. M-Alekseychuk built it in Google AI Studio for Jiuzhou Pharmaceutical process scientists. It plans designs (factorial, DSD, CCD, BBD, Plackett-Burman, D-optimal), analyses results (OLS, ANOVA, effects, diagnostics, desirability), compares responses, runs Monte Carlo robustness and Bayesian next-run suggestions, and exports JSON, Excel and HTML. It works in English and Chinese.

PR #1 reorganised the repository and documented it without changing any behaviour. PR #PRNUM added the test harness (below); it changes no calculation either. A review of the code (some of it confirmed by running the engine) registered 160 issue IDs: 14 Critical, listed below, 47 High, 63 Medium and 36 Low. Some IDs describe the same bug from two angles. All of them are recorded in the [backlog](../../spec/DOE-Magic/roadmap-backlog.md) and none are fixed yet. The next work is Phase 1 of the [goals](goals.md): tests plus statistical correctness.

## Test harness (backlog P2.1 step 1, PR #PRNUM)

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
| `50c088c` | Synced `package-lock.json`, which lacked `@modelcontextprotocol/sdk`, `zod` and `remark-gfm`, so `npm ci` failed. `bun.lock` already matched. Both lockfiles are kept for now (open decision 1). ([lesson](../../memory/DOE-Magic/lockfile-drift.md)) |
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
| `npm install` | Install dependencies |
| `npm run dev` | Start the development server on http://localhost:3000 (port fixed in [`server.ts:8`](../../../server.ts)) |
| `npm run check` | Type-check and run the layer rules. Must pass before every commit. |
| `npm test` | Run the test suite in `tests/` (vitest). Must pass before every commit. Known bugs show as expected failures |
| `npm run build` | Build the client into `dist/` and the server into `dist/server.cjs` |
| `NODE_ENV=production npm start` | Run the build. Without `NODE_ENV=production` it runs Vite dev middleware (SRV-3/BLD-1). In PowerShell: `$env:NODE_ENV="production"; npm start`. That leaves `NODE_ENV` set for the window, so a later `npm run dev` there serves the old `dist/`; close the window afterwards or run `Remove-Item Env:NODE_ENV`. |
| `npm run mcp` | Start the stdio MCP server for desktop AI clients. The config snippet shown in the app's MCP panel does not work as given (MCP-18); see [MCP server](../../context/DOE-Magic/mcp-server.md). |
| `npm run lint` | `tsc --noEmit` only |

- Remote MCP endpoints: `POST /mcp` (a hand-written JSON-RPC dispatcher, MCP-5/MCP-17) and `GET /mcp/sse` (SSE), each also under `/api/`. The SSE stream's `endpoint` event always tells the client to post messages to `POST /api/mcp/messages` ([`server.ts:237`](../../../server.ts)).
- Data: the server keeps everything in `data.json` in the directory it was started from, and each browser keeps a cache in localStorage, which the server's data overwrites on every load, so it is not a backup. There are no automatic backups (DATA-2, DATA-16). To back up, copy `data.json` while the server is stopped, or export each project as JSON. Do not run `npm run mcp` while the web server uses the same `data.json` (DATA-3). Details: [Server and persistence](../../context/DOE-Magic/server-and-persistence.md).
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
| DATA-1, UI-1 | The "Demo Studies" / "Load Demo Experiments" buttons replace every project and folder on the server, for every connected user, without asking. | Do not click them. |
| UI-3 (= STAT-7) | In multi-response projects, the Prediction Profiler fits every response except the selected one with the full model and ignores its excluded terms. | Profiler predictions and global desirability for the other responses |
| UI-4 (= STAT-8) | The HTML export draws response surfaces from the intercept plus numeric main effects only. Interactions and categorical terms are dropped. | Surface and contour plots in exported reports |

Other high-impact risks:
- SRV-1: no authentication, CORS open to every origin, and the server listens on 0.0.0.0.
- DATA-2: a crash mid-write can corrupt `data.json`. The next start then re-seeds and overwrites it.
- DATA-3: the stdio MCP and the web server overwrite each other's `data.json`.
- DATA-4: last writer wins between tabs and agents.
- SRV-2/BLD-2: a production build serves `server.cjs.map`, which contains the server source.

## Immediate next steps

1. **Owner: stop pushing from AI Studio, export every real project, then merge.** Click **Export JSON** on each real project's page and keep the files, then merge the PR on GitHub. If you run the app from a local folder, copy `data.json` aside before you pull: the file is no longer tracked, so git either deletes it on pull or, if it has local changes, refuses to pull until you move it away.
2. **Owner, with help: move to an AI Studio project made from `main`.** Re-import the project from `main`, or start a fresh one from it, then bring each project back with **Import Project** on the Dashboard. The exact AI Studio steps are unverified (see [AI Studio warning](#ai-studio-warning)).
3. **Answer the open decisions below.** The owner answers decisions 3, 4, 5 and 6 in plain words; a developer settles decisions 1, 2, 7 and 8.
4. **Follow the "suggested PR sequence" in the [roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md).** It is the authoritative order. In outline:
   - guard the one-click data-loss buttons
   - tests are in (P2.1 step 1); next comes CI that runs `npm ci`, `npm run check`, `npm test` and `npm run build` (P2.1 step 2). It first needs a lockfile again, because cc41f15 deleted both (decision 1)
   - fix the Critical statistics and design issues, one PR each. Each fix changes its own `it.fails` tests to `it` (for example P0.3 flips the 16 STAT-1 tests) and adds fixtures where the [case table](../../context/DOE-Magic/statistics-engine.md#reference-tests) has gaps

   Each PR is either move-only or a logic change, never both.

## Open decisions

| # | Decision | Who answers | Why it matters | IDs |
|---|---|---|---|---|
| 1 | Keep `bun.lock` or `package-lock.json`? Depends on which installer AI Studio uses (unknown). | Developer | Two lockfiles drift apart, and `npm ci` already broke once. | BLD-7 |
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

**Before switching, export every real project with Export JSON. After this PR merges, re-import the AI Studio project from `main`, or start a fresh one from it, before any further AI Studio edits, then bring the projects back with Import Project.** Do this again after every later merge. A new or re-imported workspace has no `data.json`, so the server starts with only the demo project, and the browser cache is overwritten by the server's data on load. The exact AI Studio steps are unverified.

AI Studio's sync may ignore `.gitignore`: it committed `assets/.aistudio/.gitignore` and `data.json` in `ef15736`. `.gitignore` only keeps files out of commits made with git. If a sync re-adds `.aistudio/` or `data.json`, `npm run check` fails R9 with a message saying so.

Root files that AI Studio needs stay in place: `server.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `metadata.json`, `.env.example`, `public/`, `assets/.aistudio/` and `src/main.tsx`. Details: [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [lesson](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md).

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
| [Lockfile drift](../../memory/DOE-Magic/lockfile-drift.md) | `package-lock.json` fell behind `bun.lock` |
| [Tailwind scans whole repo](../../memory/DOE-Magic/tailwind-scans-whole-repo.md) | Non-source files became CSS |
| [Windows long paths](../../memory/DOE-Magic/windows-long-paths.md) | Path-length limits on Windows broke clone, `npm install` and a `git init` in a temp folder; keep every working copy on a short path |
| [AI Studio sync overwrites repo](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md) | AI Studio pushes its whole workspace |
