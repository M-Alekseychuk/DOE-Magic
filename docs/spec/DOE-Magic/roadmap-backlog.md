# DOE-Magic — Roadmap and Backlog

> Created: 2026-10-20. Status: in progress. Done: P0.1 (PR #2, 2026-10-21), P2.1 step 1 (the test harness, PR #3, 2026-10-21), the `.baseline-dist/` part of P3.10, and two parts of P3.9 that the owner's commit cc41f15 made (2026-10-21); no other item is started. Decision 1 is settled (no lockfile). This file is the issue registry and the prioritised backlog. Update it in every PR that closes or changes an item.
> Related: [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Goals](../../task/DOE-Magic/goals.md), [Design spec](design-spec.md), [Statistics engine](../../context/DOE-Magic/statistics-engine.md), [Design generation](../../context/DOE-Magic/design-generation.md), [MCP server](../../context/DOE-Magic/mcp-server.md), [Server and persistence](../../context/DOE-Magic/server-and-persistence.md), [Web UI](../../context/DOE-Magic/web-ui.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [AGENTS.md](../../../AGENTS.md)

## How to use this backlog

Read [Status and handoff](../../task/DOE-Magic/status-and-handoff.md) first for the current state. This file turns the issue registry into pull requests.

- **Issue IDs** are permanent. Never renumber or reuse them. The prefixes are `STAT` (statistics engine), `DES` (design generation), `MCP` (MCP server), `SRV` (server), `DATA` (persistence and data integrity), `UI` (web UI), `I18N` (translations) and `BLD` (build and tooling). Each ID belongs to exactly one backlog item. The [ID index](#id-index) at the end maps every ID to its item, with severity and basis.
- **Background** for each prefix: `STAT` → [statistics engine](../../context/DOE-Magic/statistics-engine.md); `DES` → [design generation](../../context/DOE-Magic/design-generation.md); `MCP` → [MCP server](../../context/DOE-Magic/mcp-server.md); `SRV`, `DATA` → [server and persistence](../../context/DOE-Magic/server-and-persistence.md); `UI`, `I18N` → [web UI](../../context/DOE-Magic/web-ui.md); `BLD` → [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md) and the [design spec](design-spec.md).
- **Priority** (P0–P3) is severity. **Phase** is the roadmap phase in [Goals](../../task/DOE-Magic/goals.md) (1 correctness, 2 consolidation, 3 integrity and security, 4 polish). The [suggested PR sequence](#suggested-pr-sequence) gives the order. Some P2 enablers come first, because P0 fixes depend on them.
- **Basis** of each issue: R = confirmed by running, C = confirmed by reading, P = plausible but unverified. "Measured" figures in an item come from the 2026-10-20 audit runs.
- **New problems** get the next free number in their prefix. Add them to an item and to the index in the same PR. Findings still waiting for an ID are listed under [Unregistered findings](#unregistered-findings-awaiting-ids).
- **Status** is kept in the overview table of each priority section: `open`, `in progress (PR #n)` or `done (PR #n)`.

Every item has the same fields:

- **Covers:** the issue IDs, their severity, the PR type (move-only or logic) and a rough size (S ≈ one day, M ≈ a few days, L ≈ a week or more).
- **Problem**, **Evidence** (current paths, `file:line`), **Change**, **Where**.
- **Accept when:** testable criteria.
- **Order:** dependencies.

## Process rules

The full change process is §9 of the [design spec](design-spec.md). The rules that shape this backlog are:

1. **One PR is move-only or logic, never both.** A file split or move gets its own PR, with behaviour proven identical.
2. **Tests before statistics fixes.** No P0 statistics or design PR starts before the test harness (P2.1, step 1) is merged. Each fix adds a reference test that fails before the change and passes after it. The reference is JMP, R or a published worked example, with its source recorded next to the fixture.
3. **Contract first.** Statistical semantics, term IDs, the persisted format and MCP inputs and outputs change in the docs before the code, in the same PR (design spec §9.2).
4. **One implementation per calculation, in `src/core`.** When a consolidation switches callers to the core function, delete the fork in that PR. See [forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md).
5. **Persisted format.** Before P2.16 (schema version) lands, only additive optional fields may be added to `src/core/types.ts`. Any change to an existing field waits for the migration pipeline.
6. **Checks.** Run `npm run check`, `npm test` and `npm run build`. For server or MCP changes, also rerun the smoke check used for the restructuring PR: REST, MCP over HTTP including `run_analysis` on the demo project, stdio MCP, and dev-mode Vite.
7. **AI Studio-sensitive changes** are flagged below. They touch `package.json` scripts, `server.ts` host or port, `index.html`, `metadata.json`, `.env.example`, `vite.config.ts` or the `dist/` layout. Check them in a fresh AI Studio import before merging, and re-import AI Studio from `main` after every merge, exporting every real project with Export JSON first (a new workspace starts with only the demo project). See [AI Studio sync overwrites the repo](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md).
8. **Dependencies.** No lockfile is tracked (decision 1, settled 2026-10-21). A dependency change commits `package.json` only, made with `npm install <pkg>` or `npm uninstall <pkg>` (design spec §9.8). See [lockfile drift](../../memory/DOE-Magic/lockfile-drift.md).
9. **No scratch scripts in the repo.** See [patch scripts in the repo root](../../memory/DOE-Magic/patch-scripts-in-repo-root.md).

## Suggested PR sequence

PR 0 is the current branch `chore/project-structure-and-core-docs`. It removes the dead scripts, untracks `data.json`, syncs the lockfile, splits `src/` into layers, limits Tailwind scanning, adds `npm run check` (rules R1–R9, including the repo-root allowlist R9 from ea8091e; the checker reads imports with the TypeScript compiler API since 03f1ba0), ignores `/.aistudio/`, and adds these docs, with no behaviour change. The `.baseline-dist/` verification folder (P3.10) has been deleted; check that `git status` shows nothing else untracked before committing. The other half of P3.10, the mojibake comment in `vite.config.ts`, waits for the owner's agreement and can go in any later PR.

**Phase 1: correctness (in this order)**

| # | PR | Item | Type | Why here |
|---|---|---|---|---|
| 1 | Test harness and reference datasets for `src/core/analysis` | P2.1 step 1 | tests and tooling | **Done 2026-10-21 (PR #3).** Every P0 statistics fix needs pinned reference values |
| 2 | Demo buttons stop wiping all data | P0.1 | logic, S | **Done 2026-10-21 (PR #2).** One click destroyed every project. Needs no harness, so it can land before or alongside PR 1 |
| 3 | Confirm before replacing measured runs (UI and MCP) | P0.2 | logic, M | Same: silent loss of lab results |
| 4 | CI: `npm install`, `npm run check`, `npm test`, `npm run build` | P2.1 step 2 | tooling, S | Guards every later PR |
| 5 | QR least-squares solver | P0.3 | logic, M | Standard errors, p-values, leverage and intervals depend on it. Needed by P0.9 and P2.6 |
| 6 | Saturated-model inference (Lenth, SE, Box-Cox) | P0.4 | logic, M | |
| 7 | Model p-value and the MCP `run_analysis` contract | P0.5 | logic, M | Needs the null semantics from PR 6 |
| 8 | Profiler uses each response's saved model | P0.6 | logic, S | |
| 9 | MCP robustness clamp | P0.7 | logic, S | |
| 10 | Validate runs before fitting | P1.11 | logic, M | Defines what the solver sees. Before the quadratic terms |
| 11 | Optimum search without truncation | P0.8 | logic, M | Needed for interior optima in PR 12 |
| 12 | Quadratic terms in analysis and D-optimal | P0.9 | logic, L | Contract change: term IDs go into the docs first |
| 13 | HTML export surfaces from the fitted model | P0.10 | logic, M | After PR 12, so exported surfaces show curvature |
| 14 | Regular fractional factorials and a sourced resolution table | P0.11 | logic, L | Extends the harness with design invariants |
| 15 | Definitive screening designs from conference matrices | P0.12 | logic, M | |
| 16 | D-efficiency, randomisation and centre points | P1.18, P1.19, P1.20 | logic, one PR each | High design issues that goals.md assigns to Phase 1 |
| 17 | Optimizer target 0 | P1.21 | logic, S | One line; can be slotted anywhere |

**Pull forward if a second person is available.** These are High and small, and they depend on no Phase 1 work: P1.4 (HTML export escaping), P1.14 (exact-id MCP lookup) and P1.2 (stop serving the source map; AI Studio-sensitive, decision 7). Goals.md schedules them in Phase 3. They share files with Phase 1 PRs (`htmlExport.ts`, `doeMcpServer.ts`, `package.json`), so expect small rebases.

**Phase 2: consolidation.**
1. P2.12 step 1 (move-only split of `server.ts`) as the enabler.
2. The consolidations that close High issues: P2.3, P2.5, P2.6, P2.8.
3. P1.15, P1.16 and P1.17 (MCP contract), then P2.12 step 2.
4. P2.4, P2.9, P2.10, P2.11, P2.7, P2.13.
5. Core clean-ups: P3.4, P3.5, P3.11, P3.12.

**Phase 3: integrity and security.** Skip any item already pulled forward.
1. P2.16 (schema version) first.
2. P1.5, P1.6, P2.15, P1.10, P1.12, P2.14, P1.7, P1.8, P1.13, P1.14.
3. P1.2, then P2.2 (decision 1 is settled; both change the `package.json` scripts and the production start, and both are AI Studio-sensitive), P1.3, P1.4, then P1.1 once decisions 3 and 8 are made.
4. P1.9 and P2.18 once decision 6 is made.
5. P2.17.

**Phase 4: polish.** P1.22, P1.23, P2.19, P2.20, P2.21, then P3.1, P3.2, P3.3 and P3.6–P3.9, P3.13.

## Open decisions for the owner

Numbers 1–8 match the table in [Status and handoff](../../task/DOE-Magic/status-and-handoff.md#open-decisions).

| # | Decision | Options | Blocks | Until decided |
|---|---|---|---|---|
| 1 | Package manager and lockfile | **Settled 2026-10-21 by the developer (PR #4): npm, with no lockfile for now.** Neither `package-lock.json` nor `bun.lock` is tracked; both are in `.gitignore`. The owner's AI Studio push cc41f15 deleted both, and a restored one would be deleted by the next push; early development accepts floating versions. Revisit when AI Studio no longer pushes to `main`, when a dependency update changes a test result, or when decision 6 makes the tool GMP-relevant ([lesson](../../memory/DOE-Magic/lockfile-drift.md)) | P2.2 keeps `packageManager` and `engines` | Settled. Dependency PRs commit `package.json` only; CI uses `npm install` |
| 2 | Remove the Gemini leftovers (`@google/genai`, `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in `metadata.json:5-7`, `GEMINI_API_KEY` in `.env.example:1-2`) | Remove all of them, or keep them for AI Studio. The effect on AI Studio is unverified; try it in a scratch import first | P3.6 | Keep them. Nothing in `src/` or `server.ts` uses Gemini |
| 3 | Where the app runs: one PC, a LAN server, or AI Studio's Cloud Run deployment | One or more of these. Unverified today | P1.1 (bind address, CORS, HTTPS), P1.9, P1.6, P2.21 | Assume local use, plus Cloud Run when `K_SERVICE` or `APP_URL` is set (`server.ts:368`) |
| 4 | Keep editing in AI Studio, or move to git-only with PRs | (a) AI Studio stays an editor: re-import from `main` before each session and push only through a reviewed PR. (b) Git-only: AI Studio is retired or used read-only | All AI Studio-sensitive items (P1.1, P1.2, P2.2, P2.13, P3.6, P3.7, P3.9, P3.10) | Treat AI Studio as an editor that must be re-imported after each merge; export every real project with Export JSON before switching and bring it back with Import Project |
| 5 | Reference software that defines "correct" | JMP (which version, and is a licence available?), R, or published examples only | P2.1 fixture provenance. Every P0 statistics item | Use R `lm()`/`anova()` and published examples. Record the tool and version in each fixture |
| 6 | Is the tool used for GMP-relevant decisions or records? If so, `data.json` falls short of 21 CFR Part 11 / EU GMP Annex 11 expectations: no audit trail, no identity, no electronic signatures, no backups | (a) Declare it a non-GMP research tool and document the intended use. (b) SQLite on a durable volume plus an append-only change log. (c) A managed database. Whether Part 11 applies is the owner's QA decision; it is unverified here | P1.5 scope, P1.6, P1.9, P2.18 | Do P1.5 (atomic writes and backups) regardless. It is cheap and needed in every option |
| 7 | Move the server bundle out of `dist/` | `build/server.cjs` (already in `.gitignore`) or `dist-server/`. Either changes the `start` path AI Studio may use | P1.2 | The server source stays downloadable. Dropping only the source map is not enough: `/server.cjs` is unminified bundled JavaScript |
| 8 | Authentication model | None, with localhost-only binding; a shared token for REST, socket.io and MCP; reverse-proxy SSO through the company identity provider; or per-user accounts | P1.1. Identity in P2.18 | Bind to localhost by default and restrict CORS (P1.1 steps that need no decision) |

## P0 — Critical: wrong results a scientist would act on, and data loss

Until these land, the README warns not to trust the affected outputs.

| Item | Title | Covers | Phase | Type | Size | Status |
|---|---|---|---|---|---|---|
| P0.1 | Demo buttons stop wiping all data | DATA-1, UI-1 | 1 | logic | S | done |
| P0.2 | Confirm before replacing measured runs | DES-1, UI-2, MCP-10 | 1 | logic | M | open |
| P0.3 | Correct least squares for rank-deficient models | STAT-1 | 1 | logic | M | open |
| P0.4 | Honest inference for saturated models | STAT-2, STAT-5, STAT-21 | 1 | logic | M | open |
| P0.5 | Real model p-value and a correct MCP `run_analysis` | MCP-1, UI-31, STAT-12, MCP-6, MCP-7, MCP-8, MCP-9 | 1 | logic | M | open |
| P0.6 | Profiler fits each response's saved model | STAT-7, UI-3 | 1 | logic | S | open |
| P0.7 | Remove the MCP robustness clamp | MCP-2 | 1 | logic | S | open |
| P0.8 | Optimum search without truncation | STAT-4 | 1 | logic | M | open |
| P0.9 | Quadratic terms in analysis and D-optimal designs | STAT-3, DES-4 | 1 | logic | L | open |
| P0.10 | HTML export surfaces from the fitted model | STAT-8, UI-4 | 1 | logic | M | open |
| P0.11 | Regular fractional factorials with true resolution | DES-2, UI-14, DES-10, DES-17 | 1 | logic | L | open |
| P0.12 | Real definitive screening designs | DES-3 | 1 | logic | M | open |

### P0.1 Demo buttons stop wiping all data

- **Status:** done (2026-10-21); see [Outcome](#p01-outcome). Problem, evidence and change below are as written before the fix; their line numbers refer to `b2a9f85`.
- **Covers:** DATA-1 (Critical, C), UI-1 (Critical, C). Logic, S.
- **Problem:** "Demo Studies" and "Load Demo Experiments" both call `resetSampleData`. It replaces every project and folder on the server, in localStorage and in every connected browser, with no confirmation and no backup.
- **Evidence:**
  - `src/web/pages/Dashboard.tsx:181-187`: the toolbar button. Its tooltip at `:182` reads "Load standard demo study".
  - `src/web/pages/Dashboard.tsx:343-348`: the second button.
  - `src/web/state/ProjectContext.tsx:269-281`: replaces state and localStorage, then POSTs `/api/reset-sample`.
  - `server.ts:194-202`: replaces `db`, saves it and broadcasts to all clients.
  - `src/web/state/ProjectContext.tsx:283-312`: `loadDemoProject` has no callers.
  - `src/web/i18n/translations.ts:87`: `reset_sample_confirm` is defined but unused.
- **Change:**
  1. Both buttons load the demo additively. They insert a fresh copy from `createDemoCatalyticProject()` (`src/core/sampleProject.ts:266`). If a project with the demo id already exists, the copy gets a new id. Today `loadDemoProject` replaces a same-id project (`ProjectContext.tsx:288-290`) and saves the shared module object (`:311`).
  2. Add a shared `ConfirmDialog`.
  3. If a full reset is still wanted, put it behind the dialog with `reset_sample_confirm`.
  4. Server: `/api/reset-sample` requires the JSON body `{"confirm": true}`. A cross-site "simple" POST then cannot trigger it; a preflighted cross-site request still can until P1.1 restricts CORS (`cors()` answers every preflight today, `server.ts:12`). The server writes a timestamped backup of `data.json` before resetting.
- **Where:** `src/web/pages/Dashboard.tsx`, `src/web/state/ProjectContext.tsx`, `src/web/shared/ConfirmDialog.tsx` (new), `server.ts` (later `src/server/routes/`).
- **Accept when:**
  - With three user projects, either demo button leaves all three intact on the server and in a second browser, and the demo appears once.
  - Loading the demo again, or after editing the demo, never overwrites the edited copy.
  - `POST /api/reset-sample` without the confirm body returns 400 and changes nothing. With the body, a backup file exists before `data.json` is rewritten.
- **Order:** first, with no dependencies. The server part may be a second small PR.

#### P0.1 outcome

Done in one PR, client and server together.

- **Demo buttons.** "Demo Studies" and "Load Demo Experiments" call `loadDemoProject` (`src/web/state/ProjectContext.tsx:293-301`). It adds `createDemoProjectCopy(projects)` (`src/core/sampleProject.ts:280-286`), a fresh deep copy that keeps the demo id unless a project already has it, in which case it gets a new uuid. A missing demo folder is saved again. The Dashboard then opens the new project (`src/web/pages/Dashboard.tsx:127-130`), so the result is visible from any folder view. Labels and tooltips go through `t()` (`demo_studies`, `demo_studies_tooltip`, `load_demo_experiments`).
- **Shared dialog.** `src/web/shared/ConfirmDialog.tsx`. It renders into `document.body`, focuses Cancel, and cancels on Escape or a click outside, so a stray Enter or click never confirms.
- **Full reset.** Kept, but only as **Reset Sample Data** in the Archive view (`Dashboard.tsx:225-234`), behind `ConfirmDialog`. The text is `reset_sample_confirm`, reworded to name the project and folder counts, the backup and Export JSON, with the button `reset_sample_confirm_button`. `resetSampleData` (`ProjectContext.tsx:271-291`) posts `{"confirm": true}` and changes local state only after a 200; otherwise the Dashboard shows `reset_sample_failed`. If the owner wants no full reset in the UI at all, delete that button; the endpoint stays protected.
- **Server.** `POST /api/reset-sample` (`server.ts:194-217`) returns 400 and changes nothing unless the body is the JSON `{"confirm": true}`. With it, the server copies `data.json` to `data.json.before-reset-<timestamp>` (an ISO time with `:` and `.` replaced by `-`), or returns 500 and changes nothing if the copy fails. It then resets to `createSampleProjects()` and `createSampleFolders()` (`sampleProject.ts:289-295`), which build new objects, so an MCP edit of the seeded demo is no longer restored (the reset half of DATA-14; seeding stays with P2.15). The response adds `backup`: the file name, or `null` when no `data.json` existed. `.gitignore` ignores `data.json.*`.
- **Verified 2026-10-21** with `npm run dev` and with `NODE_ENV=production node dist/server.cjs`:
  - Before the fix, a `POST /api/reset-sample` with no body deleted three user projects.
  - After it, with three user projects, both buttons left all three on the server and in a second browser tab, and each click added exactly one demo.
  - A renamed demo was never overwritten. With the demo and its folder deleted, the copy took the demo id and the folder came back on the server.
  - No body, a `text/plain` body and `{"confirm": "yes"}` each returned 400 and changed nothing. `{"confirm": true}` returned 200, and the backup file held all four projects.
  - In the dialog, Cancel, Escape, and Enter on the focused Cancel button changed nothing. Confirm reset both tabs. A failed reset (stubbed 500) left local data alone and showed the error.
  - Reset after an MCP `update_project` rename of the demo restored the original name.
- **Not covered:** a preflighted cross-site request can still reset, until P1.1 restricts CORS. There is no automated test yet; once P2.1 provides a runner, cover `createDemoProjectCopy` and the endpoint's 400 path.

### P0.2 Confirm before replacing measured runs

- **Covers:** DES-1 (Critical, C), UI-2 (Critical, C), MCP-10 (High, R). Logic, M.
- **Problem:** Generating a design, importing an Excel run sheet or MCP `generate_doe_design` replaces all runs, including measured responses, without asking. "Simulate Sample Data" writes invented values over real ones and leaves no marker that they are simulated. MCP also turns a project's stored `centerPoints: 0` into 3 when the call does not pass `centerPoints`.
- **Evidence:**
  - Generate: `src/web/features/design/ProjectDesign.tsx:1188` calls `generateRuns` directly; `:990` runs `updateProject({ ...project, runs: newRuns })`.
  - Excel import: `:404-408` replaces all runs.
  - Simulate: `src/web/features/analysis/ProjectAnalysis.tsx:189-235` writes a value into every run of the active response; the button is at `:1125-1133`.
  - MCP: `src/server/mcp/doeMcpServer.ts:469` (`project.runs = generated.runs`); `:460` (`project.centerPoints || 3`).
  - `src/core/types.ts:29-35`: `Run` has no field that marks simulated values.
- **Change:**
  1. Before generating or importing over runs that hold measured values, show `ConfirmDialog` with the number of values that would be lost.
  2. Simulate fills only empty cells, after confirmation.
  3. MCP `generate_doe_design` refuses when any response value is set, unless the caller passes `force: true`. It then reports how many values were discarded. It uses `??` for `centerPoints`.
  4. Optional later step: a persisted "simulated" marker. This is an additive data-format change: document it in the design spec first.
- **Where:** `ProjectDesign.tsx`, `ProjectAnalysis.tsx` (move the simulate function to a pure helper so it can be tested), `doeMcpServer.ts`.
- **Accept when:**
  - Generate on a project with at least one measured value shows the count. Cancel leaves `runs` deep-equal to before.
  - The simulate helper never changes a non-null value (unit test).
  - MCP `generate_doe_design` on a project with results and no `force` returns an error and leaves the project unchanged.
  - A project with `centerPoints: 0` regenerates with 0 centre points.
- **Order:** after P0.1 (reuses `ConfirmDialog`). P1.5 later adds server-side backups.

### P0.3 Correct least squares for rank-deficient models

- **Covers:** STAT-1 (Critical, R). Logic, M.
- **Problem:** `solveOLS` inverts X'X by Gauss-Jordan with row pivoting. It reads the inverse at positions that are valid only when the pivot rows match the estimable columns. The default model (all main effects and all 2FIs) is rank-deficient for PB, DSD and D-optimal designs. On those designs, standard errors, p-values, VIF, leverage, Cook's D, intervals and Box-Cox are wrong. The coefficients themselves are correct.
- **Evidence:**
  - `src/core/analysis/analysisCore.ts:109-184`: the solver. The inverse is read at `:177`.
  - `:138`: an absolute `1e-9` aliasing threshold.
  - `:216-319`: the default model.
  - Consumers: `:586` (1-df Type III SS), `:909` (VIF), `:935-940` (SE, t, p), `:1012-1032` (leverage, studentized residuals, Cook's D), `:736` (CI and PI), `:1094` (Box-Cox).
- **Measured:** PB12 with 6 factors and 3 centre points, default model (rank 12, error DF 3). The leverages sum to 11 and the maximum is 1.067. The SE of F0 is 0.092; the reduced model gives 0.151. The worst term's SE is understated by a factor of 2.45. A regular 2^(4−1) design with centre points was correct.
- **Measured again with the test fixtures (2026-10-21):** on `tests/fixtures/pb12-6f-3cp.json` the engine reports SE 0 (so t 0 and p 1) for the main effect `Offset` and for `Temperature*Loading`, whose correct SEs are 0.379 and 0.408, and understates the SE of `Time` 2.83×. On the 6-factor DSD fixture the main effects are right, but `X2*X3` gets SE 0 and other 2FI SEs are off in both directions. `tests/core/analysis/rankDeficient.test.ts` pins this.
- **Change:**
  - Replace `solveOLS` with a Householder QR on X itself, not on X'X.
  - Process columns in model order. A column is aliased when its remaining norm falls below a relative tolerance (define the tolerance in the statistics-engine doc). This keeps today's convention: the later term in model order is the one reported as aliased.
  - Return the rank, β for the kept set S, and (X_S'X_S)⁻¹ from R_S.
  - Use the same routine for the multi-df Type III reduced fits (`:591-592`) and for Box-Cox.
- **Where:** `src/core/analysis/linalg.ts` (new), called by `analysisCore.ts`. Do not move other code in this PR.
- **Accept when:**
  - PB12 fixture: Σ `studentizedResiduals[].leverage` = rank (`p + 1` = 12) within 1e-9, and every leverage is in [0, 1].
  - For PB12, a 6-factor DSD and seeded random rank-deficient 3-level designs, SE, t, p, VIF and leverage match the explicit reduced model fitted on the estimable columns, and R `lm()` (which reports NA for aliased terms), to relative 1e-8.
  - Coefficients and aliased flags are unchanged on all characterization fixtures. Regular 2^(4−1)+cp and 2^(5−2) outputs are unchanged.
  - A full-rank design with columns scaled by 1e3 is not flagged as aliased.
- **Order:** needs P2.1 step 1. Blocks P0.9: with 2^k plus centre points, all x² columns are identical and must be flagged correctly. Also blocks parameter uncertainty in P2.6 and P3.5.

### P0.4 Honest inference for saturated models

- **Covers:** STAT-2 (Critical, R), STAT-5 (High, R), STAT-21 (Low, R). Logic, M.
- **Problem:** For an unreplicated, saturated screening model (error DF 0), the Lenth pseudo-error is scaled wrongly. t is inflated by n/4 and F by (n/4)², so almost every effect looks significant. At the same time the parameter table shows SE 0, t 0 and p 1, and the CI and PI have zero width. Box-Cox recommends 1/Y on a perfect fit.
- **Evidence:**
  - `src/core/analysis/analysisCore.ts:563`: `test_ms = pse²/(n/4)`. The correct value is n·PSE²/4, because the effect is 2β.
  - `:552-559`: the Lenth pool includes excluded terms with effect 0 (their `colIndices` are empty, so they count as not aliased: `:360`, `:395-397`, `:437`) and raw categorical max − min ranges (`:376`).
  - `:646`: the t limit is 3 when error DF is 0.
  - `:652`, `:663`: the plotted t-ratio is √F.
  - `:470`: MSE is 0 when error DF is 0. Hence SE 0 at `:919-940`; `seMean`, `sePred` 0 and `tCrit` 1.96 at `:740-742`; `undefined` reference rows at `:969-983`.
  - `:634-644`: PSE-based standard errors are computed but never exported.
  - `:1100`: logL is 0 when SSE ≤ 1e-12. `:1108-1116`: the first λ (−2) wins ties.
- **Measured:** saturated 2^(4−1) with 8 runs. Plotted t for F0 is 36.47; the Lenth t is 18.24 (ratio 2 = n/4). The F0 parameter estimate shows SE 0, t 0, p 1, while the effect test gives p = 7.5e-4. The 95% CI at the optimum is [15.28, 15.28]. Box-Cox gives λ = −2.
- **Change:**
  1. When error DF is 0, compute Lenth directly: tⱼ = |effectⱼ|/PSE; ME = t(0.975, m/3)·PSE. Pool only active, non-aliased, 1-df contrasts on the 2β scale.
  2. Parameter estimates, CI and PI return `null` with a reason ("no error DF"), or consistently use the PSE-based SE. Pick one and document it. Never emit SE 0 or a zero-width interval. Reference rows use `null`, never `undefined`.
  3. Box-Cox returns `null` when error DF < 2 or SSE ≈ 0.
- **Where:** `analysisCore.ts` ANOVA, parameter-estimate and Box-Cox sections (later `src/core/analysis/anova.ts`). Update consumers: `src/web/features/analysis/ProjectAnalysis.tsx:2606` tests `!== undefined` and would call `.toFixed` on `null`.
- **Accept when:**
  - The Lenth (1989, *Technometrics* 31:469-473) worked example reproduces the published PSE and ME.
  - Saturated 2^(4−1): the F0 Lenth t equals |effect|/PSE, and the effect test, parameter estimates and Pareto agree on significance.
  - No result contains an interval with lower = upper when error DF is 0, and the UI shows "—".
  - `boxCox` is `null` for error DF < 2 and for an exact fit.
- **Order:** after P0.3. Contract change: write it into the [statistics engine](../../context/DOE-Magic/statistics-engine.md) doc first.

### P0.5 Real model p-value and a correct MCP `run_analysis`

- **Covers:** MCP-1 (Critical, R), UI-31 (High, C), STAT-12 (High, C), MCP-6 (High, R), MCP-7 (High, R), MCP-8 (High, C), MCP-9 (High, R). Logic, M. UI-31 has the same root cause as MCP-1 and is fixed with it.
- **Problem:** `run_analysis` reports the model degrees of freedom as `summary.pValue`, and the HTML report prints the same number on its "Model p-value" card (UI-31). The prompt then tells the agent to judge significance by p < 0.05. The Pareto ranking reads fields that do not exist. Excluding terms by name does nothing. Untestable lack of fit is reported as "model adequate". The tool crashes on saturated designs with a 3+ level categorical.
- **Evidence:**
  - Model p-value: `src/server/mcp/doeMcpServer.ts:651` (`pValue: analysis.p`). `analysisCore.ts:468` (`p_model = rank − 1`), `:1164` (`p: p_model`), `:890` (`optimalConditions.pModel` is also the DF). `doeMcpServer.ts:1264-1265`: the prompt.
  - Pareto: `:664-669` reads `p.term`, `p.effect`, `p.isSignificant`. `paretoData` items have `name`, `absEffect`, `direction`, `factor` and `tRatio` (`analysisCore.ts:653-670`).
  - Exclusions: `:612` says term names. The engine matches IDs (`analysisCore.ts:220`, `:278-279`).
  - Lack of fit: `:655-662` turns a null `p_lof` (`analysisCore.ts:527-530`) into 1 and prints "adequately explains the data".
  - Crash: `:627-635` calls `.toFixed` on `undefined` reference rows (`analysisCore.ts:969-983`). `:624` has no null check on `computeAnalysis`.
  - HTML report (UI-31): `src/web/features/export/htmlExport.ts:27` exports `p: res.p`; `:736` and `:750` label and print it as "Model p-value" (14 on the demo project). `optimalConditions.pModel` (`analysisCore.ts:890`) has the same naming problem.
- **Measured:** on the demo project, `summary.pValue` = 14 with F = 261.97. `excludedTerms: ['Temperature']` still fitted 16 terms. A 2×3 full factorial (6 runs) threw "Cannot read properties of undefined (reading 'toFixed')".
- **Change:**
  1. Core adds `dfModel` and `modelPValue` = 1 − F_cdf(F; dfModel, dfError), which is `null` when dfError = 0. Do not use the name `pModel` for the p-value: it already holds the DF at `analysisCore.ts:890`. Keep `p` as a documented deprecated alias until every consumer has moved.
  2. Export a typed `AnalysisResult` for the fields consumers read, so mismatches fail `tsc`.
  3. In `run_analysis`:
     - `summary.pValue` comes from `modelPValue`.
     - The Pareto maps `name`, `absEffect`, `tRatio` and `significant = tRatio > tLimitPareto`.
     - `excludedTerms` accepts names, clean names, either interaction order or IDs, and resolves them to IDs. Unknown terms return an error that lists the valid ones. The result echoes the applied exclusions.
     - Lack of fit returns `{testable: false, reason}` when `p_lof` is null.
     - Number formatting is null-safe.
     - A `null` analysis gives a clear error.
  4. The HTML export shows `modelPValue`.
- **Where:** `src/core/analysis/analysisCore.ts`, `src/server/mcp/doeMcpServer.ts`, `src/web/features/export/htmlExport.ts`.
- **Accept when:**
  - On the demo project, `summary.pValue` equals 1 − F_cdf(261.97; dfModel, dfError), far below 0.05, and the HTML report shows the same value.
  - Every `paretoRanking` item has a term name, and active terms have `absEffect` > 0.
  - `excludedTerms: ['Temperature']` returns one term fewer and lists it as applied. An unknown name returns an error.
  - An unreplicated design returns `lackOfFit.testable = false`.
  - The 2×3 saturated factorial returns a result with null fields flagged.
  - MCP tests go through the SDK's `InMemoryTransport` client, not private fields.
- **Order:** after P0.4. Contract change: [MCP server](../../context/DOE-Magic/mcp-server.md) and statistics-engine docs first.

### P0.6 Profiler fits each response's saved model

- **Covers:** STAT-7 (High, C), UI-3 (Critical, C). Logic, S.
- **Problem:** The Prediction Profiler refits every non-active response with the full model, ignoring that response's saved `excludedTerms`. Its predictions and global desirability then differ from Compare, Robustness, the Excel export and MCP, and they change when the user switches the active response.
- **Evidence:**
  - `src/web/features/analysis/ProjectAnalysis.tsx:262`: `const ex = isAct ? excludedTerms : []`.
  - `:263-264`: the goal override is applied without the `customOptConfig.responseId` check used at `:182-183`.
  - `:2514` passes the results to `PredictionProfiler.tsx:69-84`.
  - These callers already use `resp.excludedTerms`: `src/web/features/compare/CompareResponses.tsx:121`, `src/web/features/robustness/RobustnessSimulation.tsx:72`, `src/web/pages/ProjectView.tsx:223` and `src/server/mcp/doeMcpServer.ts:794`.
- **Change:** a pure helper `fitProjectModels(project, overrides?)` fits each response with its own saved `excludedTerms`. It applies a goal or target override only when `overrides.responseId` matches. Analysis, Compare, Robustness, the Excel export and MCP all call it.
- **Where:** `src/core/analysis/projectModels.ts` (new), and the callers above.
- **Accept when:**
  - Unit test: in a 2-response project, response B's model excludes B's saved terms whichever response is active.
  - The Profiler's prediction for B at a setting equals Compare's and MCP `predict_response`'s.
- **Order:** independent.

### P0.7 Remove the MCP robustness clamp

- **Covers:** MCP-2 (Critical, R). Logic, S.
- **Problem:** `simulate_robustness` clamps each sampled factor value to [0.9·min, 1.1·max]. That is wrong for zero and negative ranges and cuts the tails of positive ones, so Cpk, PPM and pass rate are wrong.
- **Evidence:** `src/server/mcp/doeMcpServer.ts:1023`: the clamp. `:1046-1062`: SD and capability are computed from the clamped samples.
- **Measured:**
  - Range [−20, −10], nominal −19.5, SD 0.01: the simulated mean is −17.97.
  - Range [−80, −70]: the bounds cross (0.9·min = −72 is above 1.1·max = −77), so every sample becomes −72.
- **Change:** remove the clamp. Range warnings come from P1.11. Alternatively, clamp to a documented range computed with min/max arithmetic (min − 0.1·(max − min), max + 0.1·(max − min)) and return the number of clamped samples. Full consolidation with the UI is P2.6.
- **Where:** `src/server/mcp/doeMcpServer.ts`.
- **Accept when** (with `includeResidualNoise: false` and a main-effects model):
  - The simulated mean equals the model prediction at the nominal setting within 3 Monte Carlo standard errors, for ranges [−20, −10] and [−80, −70] and a positive range.
  - The simulated SD equals |slope|·SD within 5%.
- **Order:** independent. Before P2.6.

### P0.8 Optimum search without truncation

- **Covers:** STAT-4 (Critical, R). Logic, M.
- **Problem:** The optimum search enumerates {min, mid, max} per numeric factor. After each factor it keeps only the first 512 combinations in lexicographic order. With 6 or more factors the later combinations are never evaluated, so the reported optimum can be the worst setting.
- **Evidence:** `src/core/analysis/analysisCore.ts:785-811`: the grid. `:810`: `nextCombs.slice(0, 512)`.
- **Measured:** 7 numeric factors with a strong positive F0 effect, goal maximize. The reported optimum has F0 at its minimum, expected Y 5.27 and desirability 0.045. With 5–6 factors, the same data gives F0 at its maximum and Y ≈ 15.
- **Change:**
  - New `src/core/optimization/optimize.ts` maximises a supplied objective over the factor box.
  - It enumerates categorical level combinations, or coordinate-searches them when there are too many.
  - Numeric factors use a multistart bounded local search (coordinate search or projected Nelder-Mead) from a seeded Latin-hypercube start set, with an evaluation budget. Results are deterministic for a given seed.
  - `optimalConditions` calls it with today's desirability. P2.5 unifies desirability and moves MCP `optimize_desirability` onto this search (MCP-11).
  - Values keep full precision. Display rounding is P2.7.
- **Where:** `src/core/optimization/optimize.ts` (new), `analysisCore.ts`.
- **Accept when:**
  - The 7-factor case returns F0 at its maximum and the highest desirability.
  - Every candidate contains every factor id.
  - The same input and seed give identical output.
  - 10 numeric and 2 categorical factors finish within a fixed budget (for example 500 ms in CI).
  - A known quadratic test function's interior optimum is found.
- **Order:** after P0.3. Before P0.9.

### P0.9 Quadratic terms in analysis and D-optimal designs

- **Covers:** STAT-3 (Critical, C), DES-4 (High, R). Logic, L.
- **Problem:** Neither the analysis model nor the D-optimal criterion has squared terms. CCD, BBD and DSD data are fitted with a 2FI model, so curvature goes into lack of fit, and an interior optimum can never be found. "D-Optimal RSM" and custom D-optimal designs pick no mid-level points.
- **Evidence:**
  - `src/core/analysis/analysisCore.ts:216-319`: intercept, main effects and 2FIs only.
  - `src/core/types.ts:2` offers `ccd`, `bbd` and `dsd`.
  - The UI text promises curvature estimation: `src/web/features/design/ProjectDesign.tsx:1309` (CCD), `:1218` (DSD). `src/web/features/analysis/ProjectAnalysis.tsx:633` advises augmenting to RSM.
  - `src/core/design/dOptimal.ts:9-42`, `:124-139`: candidate rows are main effects with or without 2FIs.
  - The "D-Optimal RSM" fallback: `src/core/design/doeGenerator.ts:228-240` and `ProjectDesign.tsx:665-687`.
  - `predictModelResponse` handles only main and interaction terms (`analysisCore.ts:1211-1240`).
- **Measured:** custom D-optimal, 5 factors, 12 runs on a 3-level grid: 0 mid-level cells.
- **Change:**
  - One model-spec builder in core, used by both the analysis and `dOptimal`.
  - Add a quadratic term per numeric factor, by default when the data contain at least 3 distinct levels of that factor. Define its ID and display name in the design spec (§4.2) before coding; existing term IDs stay unchanged.
  - Include quadratic terms in the Type III tests, effects, hierarchy warnings, `excludedTerms`, `predictAtSettings` and `predictModelResponse`.
  - The D-optimal criterion includes quadratic columns when the design intent is response surface (the CCD/BBD fallbacks and a custom RSM option), and it enforces N ≥ p.
- **Where:** `src/core/analysis/modelSpec.ts` (new), `analysisCore.ts`, `src/core/design/dOptimal.ts`, the term toggles in `ProjectAnalysis.tsx`.
- **Accept when:**
  - A CCD fixture with a known quadratic truth recovers the coefficients, and a published CCD or BBD textbook example matches its ANOVA table.
  - On 2^k plus centre points, one pure-quadratic column is estimable and the others are flagged as aliased, without errors.
  - A fixture with an interior maximum reports an interior optimum.
  - A 5-factor D-optimal RSM design has mid-level runs for every numeric factor and can estimate all quadratic terms (rank check).
  - Saved `excludedTerms` keep working.
- **Order:** after P0.3 and P0.8. Contract change.

### P0.10 HTML export surfaces from the fitted model

- **Covers:** STAT-8 (High, C), UI-4 (Critical, C). Logic, M.
- **Problem:** The exported report draws its contour and 3D surfaces from the intercept plus numeric main effects only. Interactions and categorical terms are dropped, so colleagues who see only the report get a different response surface from the app's.
- **Evidence:**
  - `src/web/features/export/htmlExport.ts:1287-1311`: `predictSurrogate` matches parameter estimates by plain factor name. Interaction terms never match. Categorical terms are named `Name[level]` (`analysisCore.ts:225`, `:241`), so they never match either. `:1298` codes categoricals as ±1.
  - `:1270-1285`: a per-factor simple-regression fallback.
  - `:9-28`: `analysisData` carries no β or active effects.
  - The app itself uses `predictModelResponse` (`ProjectAnalysis.tsx:484-495`).
- **Change:**
  - New `surfaceGrid(result, project, xId, yId, fixedSettings, size)` in core, computed with `predictModelResponse`. Categorical factors are held at an explicit level.
  - The export precomputes grids per response for the default factor pair plus a capped set of pairs, and embeds them.
  - Delete `predictSurrogate` and the trend fallback from the template.
- **Where:** `src/core/analysis/surfaceGrid.ts` (new), `htmlExport.ts`.
- **Accept when:**
  - Every embedded grid value equals `predictModelResponse` at that setting (unit test).
  - A model with an interaction gives a non-planar exported surface.
  - The PR records the report-size change.
- **Order:** after P0.9, so curvature is included. P2.8 moves the Analysis and Compare surfaces onto the same module.

### P0.11 Regular fractional factorials with true resolution

- **Covers:** DES-2 (Critical, R), UI-14 (High, P), DES-10 (Medium, C), DES-17 (Low, C). Logic, L.
- **Problem:**
  - The "fractional factorial" is a D-optimal subset of the full grid, not a regular fraction. It does not have the resolution the selector table shows.
  - The table itself contains wrong resolutions, unreachable entries, an unexplained colour and no source.
  - DES-2 was run on the core generator. The UI path calls the same `generateDOptimalSubset` (`ProjectDesign.tsx:923`), so UI-14 very likely behaves the same; it was not run.
- **Evidence:**
  - D-optimal subset labelled "Resolution-optimized": `src/core/design/doeGenerator.ts:421-426` and `src/web/features/design/ProjectDesign.tsx:921-940`.
  - The default run target max(8, 2^(k−1)) for k > 4 is re-applied on every change: `ProjectDesign.tsx:183`, `:447-449`.
  - 2FIs enter the criterion only when N ≥ pMain + pInt + 2: `src/core/design/dOptimal.ts:139`.
  - The selector shows the table's resolution but never builds it: `src/web/features/design/TwoLevelDesignSelector.tsx:16-45`.
  - Wrong table entries in `src/core/design/designMatrixData.ts`:
    - `:62-71`: 128 runs with 12–21 factors labelled V.
    - `:78-79`: 256 runs with 13–14 factors labelled VI.
    - `:83-86`: 256 runs with 18–21 factors labelled V.
    - `:96-97`: 512 runs, 17 factors V but 18 factors VI.
  - Unreachable entries for 17–21 factors (`:34-38`, `:51-55`, `:67-71`, `:82-86`, `:96-100`); the selector columns stop at 16 (`TwoLevelDesignSelector.tsx:14`).
  - Colour `B` (`designMatrixData.ts:7`, `TwoLevelDesignSelector.tsx:39-42`) is missing from the legend (`:61-78`).
- **Measured:**
  - 4 factors, 8 runs (the table says IV): F1 is fully aliased with F2·F3, which is Res III.
  - 5 factors, 16 runs (the table says V): main effects correlate at |r| = 0.25, and main effects with 2FIs at 0.5.
  - 6 factors, 32 runs: main effects with 2FIs at 0.38.
  - Reported D-efficiency: 100, 99 and 95.
- **Change:**
  - New `src/core/design/fractions.ts` builds regular 2^(k−p) fractions from a cited minimum-aberration generator table (for example NIST/SEMATECH e-Handbook §5.3.3.4.7, or Wu & Hamada).
  - Compute the resolution and alias structure from the generators and show them.
  - Regenerate `designMatrixData.ts` from the same table and cite the source. Trim it to the displayed range, and legend or drop colour `B`.
  - Use D-optimal only for mixed or irregular cases, labelled "D-optimal subset".
  - The UI factorial branch calls the core function, so no second copy is created.
- **Where:** `src/core/design/fractions.ts` (new), `designMatrixData.ts`, `doeGenerator.ts`, `ProjectDesign.tsx`, `TwoLevelDesignSelector.tsx`.
- **Accept when:**
  - For every table cell, the generated design's computed resolution equals its label.
  - At Res IV no main effect correlates with a 2FI. At Res V all main effects and 2FIs are mutually orthogonal.
  - 4 factors, 8 runs is Res IV; 5 factors, 16 runs is Res V.
  - No D-optimal subset is called "Resolution-optimized".
  - Every colour has a legend entry, and the file cites its source.
- **Order:** add the design-invariant helpers to the harness first. Do not grow the UI fork (P2.3).

### P0.12 Real definitive screening designs

- **Covers:** DES-3 (Critical, R). Logic, M.
- **Problem:** The "DSD" is built from a parity pattern of fold-over pairs, so its main effects are strongly correlated. Real DSDs have orthogonal main effects. With categorical factors, both generators fall back to a D-optimal subset that is still labelled "Definitive Screening Design (DSD)" (`doeGenerator.ts:377`, `ProjectDesign.tsx:865`).
- **Evidence:** `src/core/design/doeGenerator.ts:380-397` and `src/web/features/design/ProjectDesign.tsx:871-894`: the pattern. `doeGenerator.ts:366-378` and `ProjectDesign.tsx:850-869`: the categorical fallback.
- **Measured:** the maximum |r| between main-effect columns is 0.667, 0.800 and 0.857 for 4, 6 and 8 factors.
- **Change:**
  - Build DSDs from conference matrices (Jones & Nachtsheim 2011; Xiao, Lin & Bai 2012), with fold-over and centre runs.
  - Add 2-level categoricals per Jones & Nachtsheim (2013).
  - For 3+ level categoricals, refuse, or fall back to a design that is labelled D-optimal.
  - The UI calls core.
- **Where:** `src/core/design/dsd.ts` (new), `doeGenerator.ts`, `ProjectDesign.tsx`.
- **Accept when** (for each supported m, with the range documented):
  - Main-effect columns are mutually orthogonal, and orthogonal to every 2FI and quadratic column.
  - Run counts match the published construction.
  - The notes match what was built.
- **Order:** after P0.11 (shared design test helpers).

## P1 — High: security exposure, data integrity, MCP contract, other wrong results

The app has no authentication, accepts any payload, and lets stale tabs and agents overwrite each other.

| Item | Title | Covers | Phase | Type | Size | Status |
|---|---|---|---|---|---|---|
| P1.1 | Lock down the server | SRV-1 | 3 | logic | M | open |
| P1.2 | Production build and start that hide the source | SRV-2, BLD-2, SRV-3, BLD-1 | 3 | logic | S | open |
| P1.3 | Replace the vulnerable SheetJS build | BLD-3 | 3 | logic | M | open |
| P1.4 | Escape the HTML export | UI-11 | 3 | logic | S | open |
| P1.5 | Atomic store with backups | DATA-2, SRV-13 | 3 | logic | M | open |
| P1.6 | One writer for `data.json` | DATA-3 | 3 | logic | M | open |
| P1.7 | Revision-checked writes on one channel | DATA-4, DATA-8, SRV-9 | 3 | logic | L | open |
| P1.8 | Visible save failures | DATA-5, DATA-21 | 3 | logic | M | open |
| P1.9 | Durable storage for deployed instances | DATA-9 | 3 | logic | M–L | open |
| P1.10 | Validate every project payload | DATA-7, DATA-10, UI-23, DATA-22, DATA-23, STAT-27 | 3 | logic | M | open |
| P1.11 | Validate runs before fitting | STAT-11, STAT-14, STAT-26 | 1 | logic | M | open |
| P1.12 | Validated run-sheet import and number entry | DATA-6, UI-12, DES-13 | 3 | logic | M | open |
| P1.13 | Confirm every destructive action | DATA-17, UI-20 | 3 | logic | S | open |
| P1.14 | Exact lookup for MCP write tools | MCP-4 | 3 | logic | S | open |
| P1.15 | Standard MCP HTTP transport | MCP-5, MCP-17, MCP-22 | 2 | logic | M | open |
| P1.16 | MCP write and predict contracts | MCP-12, MCP-14, MCP-15 | 2 | logic | M | open |
| P1.17 | Working stdio MCP configuration | MCP-18 | 2 | logic | S | open |
| P1.18 | Correct D-efficiency | DES-5, MCP-13 | 1 | logic | S | open |
| P1.19 | Valid, reproducible randomisation | DES-7 | 1 | logic | M | open |
| P1.20 | Honour the centre-point setting | DES-6, DES-19, DES-21, DES-20 | 1 | logic | M | open |
| P1.21 | Optimizer accepts a target of 0 | STAT-10, UI-10 | 1 | logic | S | open |
| P1.22 | Excel export that does not fail silently | UI-8, STAT-17 | 4 | move, then logic | S | open |
| P1.23 | Residual plot download per response | UI-13 | 4 | logic | S | open |

### Security and exposure

#### P1.1 Lock down the server

- **Covers:** SRV-1 (High, C). Logic, M. AI Studio-sensitive.
- **Problem:** There is no authentication. CORS allows every origin on REST and socket.io, and the server listens on 0.0.0.0. Any web page the scientist opens, or any LAN host, can read all process data, overwrite it or wipe it.
- **Evidence:**
  - `server.ts:12`: `cors()` with no options. `:16-18`: socket.io with origin `*`.
  - `:129-131`: `GET /api/data`. `:154-160`: `DELETE`. `:194-202`: reset, a simple request with no preflight.
  - `:298-299`: MCP `tools/call`. `:346-348`: unauthenticated `/api/mcp/logs`.
  - `:374`: listens on `0.0.0.0`.
  - `:237`: SSE transport without DNS-rebinding options.
- **Change:**
  - CORS is same-origin by default, with an allowlist from an environment variable. socket.io follows the same rule.
  - Bind to `127.0.0.1` unless `HOST` is set, or when running on Cloud Run. `server.ts:368` already detects Cloud Run (`K_SERVICE` or `APP_URL`), but today only inside the development branch, to pick the HMR port; move that check up so the production branch can use it. Cloud Run must reach the container, so keep `0.0.0.0` there; check this in AI Studio.
  - Authentication per decision 8: for example a shared token header for REST, socket and MCP, or reverse-proxy SSO.
  - DNS-rebinding protection and `allowedHosts` on the MCP transports.
  - `/api/mcp/logs` behind auth.
- **Where:** `server.ts` (after P2.12, `src/server/http/security.ts`).
- **Accept when:**
  - A request with `Origin: https://evil.example` gets no `Access-Control-Allow-Origin` header, and a preflighted DELETE fails.
  - With auth on, REST, socket connect and MCP without the token return 401 or are refused.
  - A default local start is not reachable on the LAN IP.
  - The AI Studio preview still works; record the manual check in the PR.
- **Order:** after decisions 3 and 8. Easier after P2.12 step 1.

#### P1.2 Production build and start that hide the source

- **Covers:** SRV-2 (High, C), BLD-2 (High, C), SRV-3 (High, C), BLD-1 (High, C). Logic, S. AI Studio-sensitive (decision 7). Each pair is one defect registered twice: SRV-2 = BLD-2 (the server bundle and its source map are served from `dist/`) and SRV-3 = BLD-1 (`npm start` runs the development path). Both IDs of each pair are kept and closed together.
- **Problem:** The build writes `server.cjs` and its source map into `dist/`, which production serves, so `/server.cjs.map` hands out the server, MCP and statistics source. `npm start` does not set `NODE_ENV=production`, so the "production" server runs Vite dev middleware on the source tree.
- **Evidence:** `package.json:8`: esbuild with `--sourcemap --outfile=dist/server.cjs`. `server.ts:381-383`: `express.static(dist)`. `package.json:9`: `node dist/server.cjs`. `server.ts:366-380`: when not in production, it imports `vite` and serves through the dev middleware.
- **Change:**
  - Write the server bundle outside `dist/` (decision 7). Dropping only `--sourcemap` is not enough: the build does not minify, so `/server.cjs` is itself readable.
  - Make `start` run in production without shell-specific syntax: for example `--define` in the esbuild step, or a default in `server.ts` when it runs from the bundle.
  - Update the README.
- **Where:** `package.json` scripts, `server.ts`.
- **Accept when** (after `npm run build && npm start` with no `NODE_ENV` set, on Windows and Linux):
  - `GET /` serves the built `index.html`, which references the hashed `./assets/index-*.js` (Vite `base: "./"`).
  - `GET /src/main.tsx`, `/server.cjs` and `/server.cjs.map` return neither source nor a source map.
  - The AI Studio deploy still starts (manual).
- **Order:** any time. Coordinate with decision 4.

#### P1.3 Replace the vulnerable SheetJS build

- **Covers:** BLD-3 (High, R). Logic, M.
- **Problem:** npm `xlsx` 0.18.5 parses user-uploaded workbooks. It has prototype-pollution and ReDoS advisories, with no npm fix. `npm audit --omit=dev` reported 10 vulnerabilities (1 low, 5 moderate, 2 high, 2 critical).
- **Evidence:** `src/web/features/design/ProjectDesign.tsx:7` (`import { read, utils } from 'xlsx'`) and `:210` (`read(data, ...)`). The export uses a second SheetJS copy, `xlsx-js-style` (`src/web/pages/ProjectView.tsx:55`).
- **Change:**
  - Move to the SheetJS 0.20.x distribution or another parser (for example exceljs), and use one library for import and export.
  - Run `npm audit fix` for the transitive `qs` and `source-map-js` advisories.
  - Removing the unused `jspdf` belongs to P3.6.
- **Where:** `package.json`, `src/web/features/design/`, `src/web/features/export/`.
- **Accept when:**
  - `npm audit --omit=dev` shows no spreadsheet-library advisory.
  - A workbook exported by the app re-imports to identical runs.
  - The bundle does not grow.
- **Order:** any time (decision 1 is settled: no lockfile to update). The importer itself changes in P1.12.

#### P1.4 Escape the HTML export

- **Covers:** UI-11 (High, C). Logic, S.
- **Problem:** Project, factor, level and response names go into the report's HTML unescaped. A name from an imported JSON file or an MCP `create_project` call can run script in the browser of anyone who opens the shared report. At minimum, names containing `<` or `&` break the layout.
- **Evidence:** `src/web/features/export/htmlExport.ts:52` (`<title>`), `:83-84` (name, description), `:124`, `:126` (factor names, levels), `:528-538` (the in-report script builds `innerHTML` from category names and level labels). The embedded JSON at `:318-319` is already escaped.
- **Change:** an `escapeHtml` helper for every template interpolation. The in-report script builds the category buttons with DOM APIs and `textContent`.
- **Where:** `htmlExport.ts`.
- **Accept when:** a project whose name, description, factor, level and response are `<img src=x onerror=alert(1)>` and `A & B` exports a report in which they all appear as text and no element executes (unit test on `generateExportHTML` output).
- **Order:** any time.

### Data integrity

#### P1.5 Atomic store with backups

- **Covers:** DATA-2 (High, C), SRV-13 (Medium, R). Logic, M.
- **Problem:**
  - `data.json` is truncated and rewritten in place. If a crash leaves broken JSON, the next start only logs the parse error, seeds sample data, and the first save overwrites the damaged file. Every project is lost, with no backup.
  - A file that parses to a non-object, such as `null`, crashes startup instead (SRV-13).
- **Evidence:**
  - `server.ts:62-68` (`writeFileSync` of the whole file), `:26-34` (a parse error is only logged), `:37-38` (seeding follows). The same pattern is in `src/server/mcp/stdio.ts:11-19` and `:32-38`.
  - SRV-13: `server.ts:28` sets `db` to `null`; `:29` then throws inside the `try`, which logs it as a parse failure; `:37` throws an uncaught `TypeError` (reading `projects` of `null`). `stdio.ts:13`, `:14` and `:21` have the same pattern (by reading).
- **Measured:** a `data.json` containing `null` made `server.ts` log "Failed to parse data.json" and exit with `TypeError: Cannot read properties of null (reading 'projects')`.
- **Change:**
  - Write to a temporary file and rename it into place.
  - Keep N rotating backups.
  - Take over the copy that P0.1 makes before a reset (`data.json.before-reset-<timestamp>`, `server.ts:200-209`), so there is one backup implementation.
  - On a parse failure, or a file that parses but is not an object, move the file aside as `data.json.corrupt-<timestamp>` and stop. Never re-seed over it.
  - The same store module serves `server.ts` and `stdio.ts`.
- **Where:** `src/server/store/jsonFileStore.ts` (created by P2.12 step 1).
- **Accept when:**
  - Injecting a failure during the write leaves the previous file intact and parseable.
  - A corrupt `data.json` is never overwritten. A file containing `null` is moved aside and the server stops with a clear message instead of a `TypeError` (SRV-13).
  - After N + 1 saves, exactly N backups exist.
- **Order:** after P2.12 step 1. Decision 6 may change the backend later; this item is needed in every option.

#### P1.6 One writer for `data.json`

- **Covers:** DATA-3 (High, C). Logic, M.
- **Problem:** The Express server and the stdio MCP process each load `data.json` once and rewrite the whole file from their own copy. With both running, the last one to save erases the other's changes. Results recorded by a stdio agent never reach the UI.
- **Evidence:** `server.ts:9`, `:25-34`, `:62-68`. `src/server/mcp/stdio.ts:8-19`, `:32-38`, `:57` (`broadcastSync` is a no-op).
- **Change:**
  - The stdio MCP becomes a thin bridge to the running server's HTTP MCP endpoint (needs P1.15).
  - If stdio must also work without the server (decision 3), use a file lock and reload before every write.
- **Where:** `src/server/mcp/stdio.ts`, `src/server/store/`.
- **Accept when:** in a scripted test with both processes running, a stdio `add_run_results` followed by a UI edit to another field leaves both changes in `data.json`, and the UI shows the results without a reload.
- **Order:** after P1.15 and P2.12.

#### P1.7 Revision-checked writes on one channel

- **Covers:** DATA-4 (High, C), DATA-8 (High, P), SRV-9 (Low, C). Logic, L. Data-format change.
- **Problem:**
  - Every save sends and replaces the whole project, with no version check. Stale tabs, other users and MCP writes overwrite each other silently.
  - Each edit is sent twice, over HTTP and socket, and the REST broadcast echoes back to the sender, which can revert quick successive keystrokes. This part was not reproduced.
  - Each write also pretty-prints the whole database to disk and broadcasts the whole database.
- **Evidence:**
  - Whole-object replace: `server.ts:78-87`, `:137-151`, `:225-235`.
  - Double send: `src/web/state/ProjectContext.tsx:172-195`.
  - `server.ts:150`: `io.emit` reaches the sender too. `:86`: the socket path broadcasts to others.
  - Incoming sync replaces local state: `ProjectContext.tsx:134-143`.
  - Save on every keystroke: `src/web/features/setup/ProjectSetup.tsx:182`.
  - `server.ts:13` (50 MB body limit), `:62-68` (full pretty-printed write), `:75`, `:86`, `:150` (full-database broadcasts).
- **Change:**
  - `Project.revision`. The server rejects a stale write with 409 and returns the current project; the client re-fetches and merges.
  - One write channel (REST). Per-entity events (`project_updated {id, revision}`) are not echoed to the originator.
  - Debounce text-field saves.
  - Debounced atomic store writes without pretty-printing, and a lower body limit.
- **Where:** `src/core/types.ts`, `src/server/store/`, `src/server/realtime/`, `src/web/state/`.
- **Accept when:**
  - Client B writing on revision n after client A wrote n + 1 gets a 409 and shows a conflict.
  - MCP `add_run_results` followed by a keystroke in an older tab keeps the results.
  - Typing 10 characters causes at most two HTTP writes, and no full-database broadcast.
  - Events carry only the changed project.
- **Order:** after P2.12, P2.16 and P2.14.

#### P1.8 Visible save failures

- **Covers:** DATA-5 (High, C), DATA-21 (Medium, C). Logic, M.
- **Problem:**
  - Network errors are only logged to the console, and HTTP error statuses are never checked. Edits made while the server is unreachable live only in localStorage, and the next load replaces them with the server's copy.
  - Live sync gives up for good after a short outage (DATA-21). The socket.io client stops after three failed reconnects and nothing handles the give-up. The tab never receives `sync_data` again until it is reloaded, while every edit still POSTs the whole project, so a stale tab silently overwrites newer data (feeds DATA-4).
- **Evidence:** `src/web/state/ProjectContext.tsx:185-189` (`.catch` → `console.warn`; `res.ok` is never checked), `:210-211`, `:82-95` (the server copy replaces local state on load), `:134-143`. DATA-21: `ProjectContext.tsx:127-131` (`reconnectionAttempts: 3`); no `reconnect_failed` handler anywhere in `src/`; `:172-195` (saves still POST over HTTP).
- **Change:**
  - Check `res.ok`.
  - Show a persistent "not saved" banner.
  - Keep a dirty queue in the local cache and retry it.
  - Keep reconnecting the socket (no attempt cap, or handle `reconnect_failed`). While live sync is down, show the banner; on reconnect, re-fetch before the next write.
  - On reconnect, reconcile by revision (P1.7).
- **Where:** `src/web/state/` (the API client from P2.14).
- **Accept when:**
  - With the server stopped, an edit shows the banner. After a restart the queued edit is saved and the banner clears.
  - A 400 response shows an error.
  - A reload with unsaved edits does not silently drop them.
  - With the server stopped for longer than the client's reconnect window and then restarted, the tab shows the banner while it is down and receives `sync_data` again afterwards without a reload (DATA-21).
- **Order:** with or after P2.14, and after P1.7.

#### P1.9 Durable storage for deployed instances

- **Covers:** DATA-9 (High, P). Logic, M–L.
- **Problem:** On Cloud Run, which AI Studio uses to deploy, `data.json` lives on the container's temporary filesystem. It is lost on each new revision, restart or scale-to-zero, and multiple instances keep diverging copies. How the owner actually deploys the app is unverified.
- **Evidence:** `server.ts:9` (path from `process.cwd()`), `:368` (Cloud Run detection), `:62-68`.
- **Change:**
  - State in the README and the [server and persistence](../../context/DOE-Magic/server-and-persistence.md) doc that a deployed instance is not durable storage.
  - Add a store adapter interface. Implement the backend chosen in decisions 3 and 6, plus export and backup.
- **Where:** `src/server/store/`.
- **Accept when:**
  - The decision is recorded.
  - The file adapter and the chosen adapter pass the same store tests.
  - A deployed instance survives a restart without data loss (manual).
- **Order:** after decisions 3 and 6, and after P1.5.

#### P1.10 Validate every project payload

- **Covers:** DATA-7 (High, R), DATA-10 (Medium, C), UI-23 (Medium, C), DATA-22 (Low, C), DATA-23 (Medium, C), STAT-27 (Low, C). Logic, M. Contract change.
- **Problem:**
  - REST checks only that `id` exists, and socket and MCP check nothing. One malformed project breaks MCP listing and UI pages for everyone.
  - JSON import barely validates.
  - There is no root error boundary, so one bad project can blank the whole app.
  - Categorical `Factor.min`/`max` has no single convention, so code that falls back to the midpoint picks a different level depending on how the project was created (DATA-22).
  - Factor and response names are not checked for uniqueness, yet some paths key by name, so duplicate names silently collide (DATA-23).
  - A 1-level categorical factor is accepted. The engine names its column `name[undefined]` and codes it as a constant column (STAT-27).
- **Evidence:**
  - `server.ts:137-148` (REST), `:78-84` and `:95-101` (socket).
  - `src/server/mcp/doeMcpServer.ts:113`: `p.runs.filter` throws for a record without runs.
  - `src/web/pages/Dashboard.tsx:53`: `p.description.toLowerCase()` throws without a description.
  - `Dashboard.tsx:76-108`: import checks only that `factors`, `responses` and `runs` are arrays, and keeps `folderId` and `isArchived`.
  - `src/web/pages/ProjectView.tsx:44-52`: the export carries no format or version marker.
  - `src/web/App.tsx:15-30`: no error boundary.
  - DATA-22: the UI writes `0` and `levels.length − 1` (`src/web/features/setup/ProjectSetup.tsx:76-77`, `:115-116`); MCP `create_project` writes the zod defaults `0`/`100` (`src/server/mcp/doeMcpServer.ts:229-230`); `simulate_robustness` falls back to the numeric midpoint `(min + max)/2`, also for categoricals (`:1015`). Details: [design spec §4.3](design-spec.md#43-factor-range-and-name-conventions-data-22-data-23).
  - DATA-23: `optimize_desirability` builds `namedFactors[f.name]` (`doeMcpServer.ts:898-900`) and maps back with `rawSetting[f.id] = c.factors[f.name]` (`:916-921`); `predicted[r.name]` (`:885`); the Excel import matches columns by name (`src/web/features/design/ProjectDesign.tsx:254-292`, inside `handleImportExcel`, `:200-408`).
  - STAT-27: `src/core/analysis/analysisCore.ts:225` names the column `` `${f.name}[${levels[1]}]` ``, which is `name[undefined]` for one level; `getFactorContrasts` (`:58-88`) returns −1 for every run (`:70-71`).
- **Measured:** after `{id: 'bad', name: 'Bad'}` was stored, `list_projects` failed for all agents.
- **Change:**
  - zod schemas for `Project` and `Folder` in core. zod is already a dependency (`package.json:45`). Allowing it in `src/core` changes rule R3: update `CORE_PACKAGES` in `scripts/check-boundaries.mjs` and the design spec in the same PR.
  - Validate at REST (400), socket (error event), MCP inputs and JSON import.
  - Exports are wrapped as `{format: 'doe-magic-project', schemaVersion, project}`.
  - Import normalises: empty description, unknown `folderId` dropped, `isArchived: false`.
  - A root `ErrorBoundary`, and optional chaining in the filters.
  - The schema defines categorical `min = 0`, `max = levels.length − 1` (or ignores min/max for categoricals) and migrates old values (DATA-22).
  - Factor names and response names are unique after trimming, ignoring case (DATA-23); internal maps are keyed by id.
  - A categorical factor needs at least 2 levels (STAT-27).
- **Where:** `src/core/schema.ts` (new), `src/server/routes/`, `src/server/realtime/`, `Dashboard.tsx`, `src/web/shared/AppErrorBoundary.tsx` (new), `App.tsx`.
- **Accept when:**
  - `POST /api/projects {id: 'bad'}` returns 400 and nothing is stored or broadcast. An invalid socket update is rejected.
  - A bad record already in `data.json` is skipped and reported, and `list_projects` still works.
  - A file without a description imports, and search works.
  - A render error shows the boundary screen.
  - A project with two factors of the same name, or a 1-level categorical, is rejected with a message naming the field. MCP `optimize_desirability` keys its saved candidates by factor id.
  - A categorical factor created in the UI and one created over MCP store the same `min`/`max`.
- **Order:** with P2.16 (schema version), which migrates the categorical `min`/`max` values (DATA-22).

#### P1.11 Validate runs before fitting

- **Covers:** STAT-11 (High, C), STAT-14 (Medium, C), STAT-26 (Low, P). Logic, M. Contract change.
- **Problem:** Missing or unparseable factor values, and unknown categorical labels, are silently coded as real settings. Non-numeric response strings pass the run filter and turn every statistic into NaN. Coded values are clamped to [−2, 2], so out-of-range data and extrapolations flatten without warning.
- **Evidence:**
  - `src/core/analysis/analysisCore.ts:82-86`: `Number('')` is 0, so a blank cell is coded as the natural value 0. NaN is coded as 0, the centre. `:86` clamps.
  - `:62-68`: an unknown label becomes level 0.
  - `:191`: the filter removes only null, undefined and `''`.
  - `src/core/design/dOptimal.ts:19`: design selection uses the same coding.
  - `src/web/features/design/ProjectDesign.tsx:362`, `:365`: import writes 0 or `f.min` for missing values.
  - `server.ts:78`, `:137`: no validation at the server.
- **Change:**
  - `validateRuns(project, response)` in core excludes and reports runs with a missing or non-finite numeric factor, an unknown categorical label, or a non-finite response.
  - The result gains `excludedRuns: [{runId, runOrder, reason}]` and `warnings`.
  - Coding does not clamp. Data and predictions outside [min, max] are flagged as extrapolated.
- **Where:** `analysisCore.ts` (later `src/core/analysis/coding.ts`), plus the UI list of excluded runs.
- **Accept when:**
  - A blank numeric cell excludes and reports its run. Today that run is fitted at the natural value 0, which is coded −1.67 for a 20–80 range.
  - A misspelt level excludes its run instead of becoming level 1.
  - A response of `'12.5a'` excludes its run, and all statistics stay finite.
  - A run 1.5 ranges outside the box is coded at its true value, with a warning.
- **Order:** after P0.3.

#### P1.12 Validated run-sheet import and number entry

- **Covers:** DATA-6 (High, C), UI-12 (High, C), DES-13 (Medium, C). Logic, M.
- **Problem:**
  - The Excel run import invents values, accepts unknown levels and duplicate run orders, and replaces all runs. Its success message still reports success.
  - Comma-to-dot replacement turns "1,000" into 1 and "1,250" into 1.25, in import and in manual entry.
- **Evidence:**
  - Factor parsing: `src/web/features/design/ProjectDesign.tsx:352-366`. Categoricals are taken as-is (`:355`), non-numeric text is kept in a numeric factor (`:359`), an empty cell becomes 0 (`:362`) and a missing column becomes `f.min` (`:365`).
  - `:376-378`: a non-numeric response becomes null silently.
  - `:328-344`: run order is read from the sheet, and duplicates are accepted.
  - `:404-408`: all runs are replaced.
  - Comma replacement: `:47`, `:91` (`DecimalInput`), `:357`, `:376` (import), `:1095`, `:1119` (entry).
- **Change:**
  - A pure parser and validator in core takes the sheet rows. Workbook reading stays in `src/web`, because R3 forbids `xlsx` in core.
  - One numeric parser with a single decimal-separator rule rejects ambiguous input.
  - A preview lists the problem cells. Import is blocked while factor cells have errors.
  - Replacing runs asks first, using `ConfirmDialog` from P0.1. Merge by `runOrder` is offered.
- **Where:** `src/core/io/runMatrixImport.ts` and `src/core/io/parseNumber.ts` (new), `ProjectDesign.tsx`.
- **Accept when:**
  - Fixture sheets with a blank cell, an unknown level, "1,250", "<0.1" and a duplicate run order each report the row and column, and nothing is imported until they are fixed.
  - A sheet exported by the app re-imports identically.
  - Typing "1,250" into a response cell is rejected with a message.
- **Order:** after P0.2. Shares rules with P1.11.

#### P1.13 Confirm every destructive action

- **Covers:** DATA-17 (Medium, C), UI-20 (Medium, C). Logic, S.
- **Problem:** Permanently deleting an archived project, deleting a folder, a factor or a response, all happen on one click. The MCP playground is pre-filled with calls that change the demo project.
- **Evidence:**
  - `src/web/pages/Dashboard.tsx:311-313` → `ProjectContext.tsx:201-215`: the hard delete. `:198` reads `projects` from a closure.
  - `src/web/Layout.tsx:49-51`, `:106-107`: folder delete.
  - `src/web/features/setup/ProjectSetup.tsx:141-143`, `:161-163`: factor and response delete.
  - `src/web/i18n/translations.ts:83`: `delete_confirm_msg` is unused.
  - `src/web/features/mcp-panel/McpModal.tsx:78-113`: playground defaults include `generate_doe_design`, `add_run_results` and `update_project` on `proj-suzuki-cross-coupling`.
- **Change:**
  - Use `ConfirmDialog` for every listed control. Cascade clean-up of dependent data is P2.17.
  - The playground defaults to read-only tools. Write examples target a scratch project.
  - `deleteProject` uses functional state.
- **Where:** the files above and `src/web/shared/ConfirmDialog.tsx`.
- **Accept when:**
  - Each listed control asks first, and Cancel changes nothing.
  - Opening the MCP panel and pressing Execute with the defaults changes no data.
- **Order:** after P0.1.

### MCP contract

#### P1.14 Exact lookup for MCP write tools

- **Covers:** MCP-4 (High, R). Logic, S.
- **Problem:** Project and response lookups fall back to substring matching, so destructive tools can hit the wrong project. An empty id matches, and deletes, the first project.
- **Evidence:** `src/server/mcp/doeMcpServer.ts:62-69` (`findProject`: exact id, then exact name, then substring), `:81-87` (`resolveResponse` substring), `:403-406` (`delete_project`), `:347-357` (`update_project`), `:455-475` (`generate_doe_design`).
- **Measured:** `delete_project {projectId: 'Opt'}` deleted "Suzuki-Miyaura Cross-Coupling API Optimization". `{projectId: ''}` deleted the first project.
- **Change:**
  - Write tools accept an exact id or an exact, unique name. Empty or whitespace ids are rejected.
  - More than one match returns an "ambiguous" error listing the candidates.
  - Substring search remains only in read tools.
  - `delete_project` archives first, as the UI does.
- **Where:** `doeMcpServer.ts` (later `src/server/mcp/lookup.ts`).
- **Accept when:**
  - `''` and `'Opt'` return errors and change nothing.
  - Two partial matches return "ambiguous" with both ids.
  - `add_run_results` with the response key `'Yie'` returns an error.
- **Order:** any time.

#### P1.15 Standard MCP HTTP transport

- **Covers:** MCP-5 (High, R), MCP-17 (Medium, R), MCP-22 (Low, C). Logic, M.
- **Problem:**
  - `POST /api/mcp` calls tool handlers directly, so zod validation and defaults are skipped: `create_project` creates no runs and stores `undefined` fields.
  - The hand-written dispatcher is a partial, non-conformant MCP that reads private SDK fields.
  - Remote clients get only the deprecated SSE transport, with per-process sessions.
- **Evidence:**
  - Direct handler call: `src/server/mcp/doeMcpServer.ts:1369-1391` (`tool.handler(toolArgs)`).
  - `:1351-1360`: `tools/list` returns serialized zod internals. `:1394-1418`: resources and prompts are read from private maps; resource templates and prompt arguments are missing. `:1337`: the protocol version is hard-coded.
  - `server.ts:317-358`: `/api/mcp/info` reads private fields. `server.ts:21` and `:246-272`: `SSEServerTransport`, which SDK 1.32.1 marks deprecated. `:275-297`: the session map.
  - `src/web/features/mcp-panel/McpModal.tsx:81-92`: the playground's `create_project` example has a categorical factor without `min`/`max`.
- **Measured:** `create_project` over `/api/mcp` gave 0 runs, with `designType` and `centerPoints` undefined.
- **Change:**
  - Serve `StreamableHTTPServerTransport` (shipped in SDK 1.32.1 as `server/streamableHttp.js`; stateless mode is fine) on `/mcp` and `/api/mcp`.
  - Keep `/mcp/sse` as a legacy alias.
  - Delete `handleDirectJsonRpc`.
  - Build `/api/mcp/info` from an in-process client's `tools/list`.
  - The playground uses the standard protocol.
- **Where:** `src/server/mcp/http.ts` (new), mounted from `server.ts`; `McpModal.tsx`.
- **Accept when:**
  - An SDK client and MCP Inspector connect over Streamable HTTP.
  - A wrongly typed argument returns an invalid-params error, and nothing is stored.
  - `create_project` over HTTP generates runs exactly as over stdio.
  - `tools/list` returns JSON Schema. Resource templates and `prompts/get` work.
  - `grep -rn "_registered" src server.ts` finds nothing.
  - Whether the AI Studio proxy passes Streamable HTTP is unverified; check it.
- **Order:** after P2.12 step 1.

#### P1.16 MCP write and predict contracts

- **Covers:** MCP-12 (Medium, C), MCP-14 (Medium, C), MCP-15 (Medium, C). Logic, M.
- **Problem:**
  - `optimize_desirability` saves an "optimum" when no model could be fitted, treats weight 0 as 1, and overwrites the UI's optimisation report.
  - `add_run_results` stores unknown response keys verbatim, matches duplicate run orders ambiguously, and skips unmatched runs without saying so.
  - `predict_response` ignores unknown factor keys and returns no interval.
- **Evidence:**
  - `src/server/mcp/doeMcpServer.ts:792-795`: models can be null. `analysisCore.ts:186-192` returns null; `:1197`: `predictModelResponse(null)` returns 0.
  - `doeMcpServer.ts:890`: `weights[r.id] || weights[r.name] || 1`.
  - `:778`: the description promises "Pareto" settings.
  - `:916-924`: overwrites `optimizationResults`, which holds the UI's Markdown report (`ProjectOptimization.tsx:636`).
  - `:542-559`: the first run with a matching order wins, and an unknown key is stored at `:555`. `:575-585`: only a count is returned.
  - `:72-78`: `resolveFactorId` returns unknown keys unchanged. `:725-732`: no interval.
- **Change:**
  - Fail on responses without a model, or exclude and list them.
  - Use `??` for weights, and fix the tool description.
  - Store MCP results in their own field, or in the UI's structured format (decide with P2.7).
  - `add_run_results` validates first, reports per item and writes all or nothing.
  - `predict_response` rejects unknown keys, lists defaulted factors, flags extrapolation and returns the CI and PI from core (`getPointStats`, `analysisCore.ts:728-754`).
- **Where:** `doeMcpServer.ts`, `src/core/analysis/`.
- **Accept when:**
  - A response without data gives an error or is listed as excluded, with no optimum saved for it.
  - Weight 0 is respected.
  - An unknown response key or an ambiguous run order returns an error, and nothing is written.
  - An unknown factor key returns an error.
  - `predict_response` returns CI, PI and an `extrapolated` flag.
- **Order:** after P0.5 and P1.15.

#### P1.17 Working stdio MCP configuration

- **Covers:** MCP-18 (Medium, R). Logic, S.
- **Problem:** The stdio config shown in the UI does not work as given. It has no `cwd`, npm prints its banner on stdout before any JSON-RPC, and plain `npm` usually cannot be spawned without a shell on Windows (unverified per client).
- **Evidence:** `src/web/features/mcp-panel/McpModal.tsx:178-189` (`{command: 'npm', args: ['run', 'mcp']}`), `:166-176` (the remote snippet), `package.json:10`, `src/server/mcp/stdio.ts:1` (shebang), `:8` (data path from `process.cwd()`).
- **Measured:** `npm run mcp` printed the npm banner on stdout ahead of JSON-RPC.
- **Change:**
  - Generate a snippet that runs the project-local `tsx` on the absolute path of `stdio.ts`, with `cwd` set; or `npm run -s mcp` with `cwd`.
  - Make the data file configurable (`DOE_DATA_FILE`).
  - Remove the shebang.
  - Document per-client configuration in [mcp-server.md](../../context/DOE-Magic/mcp-server.md).
- **Where:** `McpModal.tsx`, `stdio.ts`, `package.json`.
- **Accept when:**
  - Spawning the documented command from another directory gives JSON-RPC from the first byte on stdout and uses the intended data file.
  - Claude Desktop on Windows connects; record the manual check.
- **Order:** before P1.6 settles stdio's role.

### Other wrong results (High)

#### P1.18 Correct D-efficiency

- **Covers:** DES-5 (High, R), MCP-13 (Medium, R). Logic, S.
- **Problem:** D-efficiency is multiplied by 100 twice on the MCP path ("10000.0%"). It is a constant 95 for singular designs and clamped to 25–100. Designs with fewer runs than parameters are shown as efficient.
- **Evidence:**
  - Double scaling: `src/core/design/doeGenerator.ts:108` and `src/server/mcp/doeMcpServer.ts:494` (the value is already 0–100).
  - `src/core/design/dOptimal.ts:203-206`: 95 when a log-determinant is −1e9, floor 25, cap 100. `:114`: N is raised only to k + 1, not to pMain. `:119`: 100 when N ≥ M.
  - `src/web/features/design/ProjectDesign.tsx:165-173`: the CCD target is 0 without continuous factors, and the BBD target is 0 with fewer than 3.
  - `:1512-1514`: the UI shows the value without the extra ×100.
- **Measured:** custom D-optimal over MCP reported "D-Efficiency: 10000.0%".
- **Change:**
  - Report the standard 100·|X'X|^(1/p)/N on the coded scale, for the stated model.
  - Report "not estimable" for singular designs.
  - Enforce or warn on N ≥ p.
  - Drop the extra ×100, and document the unit.
- **Where:** `dOptimal.ts`, `doeGenerator.ts`, `doeMcpServer.ts`.
- **Accept when:**
  - A 2^3 full factorial with a main-effects model gives 100%.
  - MCP and the UI show the same number.
  - A singular design gives "not estimable".
  - No value exceeds 100.
- **Order:** with the P0.11 tests.

#### P1.19 Valid, reproducible randomisation

- **Covers:** DES-7 (High, C). Logic, M. Additive data-format change.
- **Problem:** Designs created over MCP run in standard order. The UI shuffles with a biased, unseeded comparator and does not record it, so the order cannot be reproduced or audited. Standard order is lost for CCD, BBD, PB and DSD, and replicates are appended unrandomised.
- **Evidence:**
  - `src/core/design/doeGenerator.ts:74-77`: `runOrder = stdOrder`.
  - `src/web/features/design/ProjectDesign.tsx:987-988`: `sort(() => Math.random() - 0.5)`.
  - `stdOrder: 0` at `:628`, `:893`, `:899` and `:979`.
  - `:1053-1067`: replicates are appended in order.
- **Change:**
  - A pure `randomize(runs, seed)` in core: Fisher-Yates with a seeded PRNG.
  - Store the seed on the project. This is an additive field; document it first.
  - Assign `stdOrder` before shuffling for every design type.
  - MCP randomises by default, with an option to keep standard order.
  - The UI fork calls the core function until P2.3 removes the fork.
- **Where:** `src/core/design/randomize.ts` (new), `doeGenerator.ts`, `ProjectDesign.tsx`.
- **Accept when:**
  - The same seed gives the same order.
  - Over many seeds, all 24 orders of 4 runs occur with roughly equal frequency (chi-square, p > 0.01).
  - `stdOrder` is 1..N and unique for every design type, in the UI and over MCP.
  - The seed is shown in the UI and the export.
- **Order:** before P2.3.

#### P1.20 Honour the centre-point setting

- **Covers:** DES-6 (High, C), DES-19 (Medium, C), DES-21 (Medium, C), DES-20 (Low, C). Logic, M.
- **Problem:**
  - The user's centre-point count is ignored for CCD, BBD, DSD and PB in the UI. MCP turns a stored 0 into 3 when the call omits `centerPoints` (an explicit 0 is honoured), and core forces at least 1 for CCD, BBD and DSD. Categorical centre runs are all pinned to the first level.
  - The UI adds `project.centerPoints` "centre" runs to `factorial_2level` and `custom_d_optimal` designs even when every factor is categorical. They are duplicates of one corner run with every factor at `levels[0]`. Core adds them only when a continuous factor exists (DES-19).
  - Core adds no centre points to custom D-optimal designs or to the D-optimal-subset fractions, even when `options.centerPoints` > 0, while the UI does add them for custom D-optimal. This is another divergence between the forks ([forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md)) (DES-21).
  - "Add centre points" and "Add axial points" write `undefined`, not `''`, for a categorical factor whose `levels` is an empty array, because `fac.levels ? fac.levels[0] : ''` is truthy for `[]` (DES-20).
- **Evidence:**
  - The setting and its explanation: `src/web/features/setup/ProjectSetup.tsx:174-188`.
  - The UI applies it only to `factorial_2level` and `custom_d_optimal`: `src/web/features/design/ProjectDesign.tsx:963-964`.
  - The UI hard-codes one centre run: `:569-573`, `:706-708`, `:895-899`.
  - Core forces at least one: `src/core/design/doeGenerator.ts:151`, `:214`, `:260`, `:399` (`Math.max(1, centerPoints)`).
  - Categorical centre runs at `levels[0]`: `doeGenerator.ts:337-339`, `:437`; `ProjectDesign.tsx:969`.
  - DES-21: core adds no centre points to custom D-optimal designs (`doeGenerator.ts:91-108`) or to D-optimal-subset fractions (`:421-426`); only the full factorial adds them (`:430-444`). The UI adds them for `custom_d_optimal` (`ProjectDesign.tsx:963-964`).
  - DES-19: `ProjectDesign.tsx:962-984` adds `cpCount` runs for `factorial_2level` and `custom_d_optimal` with no check for a continuous factor; categoricals get `levels[0]` (`:969`). Core checks `continuousFactors.length > 0` (`doeGenerator.ts:431`).
  - DES-20: `ProjectDesign.tsx:1000` (`addCenterPoints`), `:1026` and `:1039` (`addAxialPoints`).
  - The MCP `||` default is fixed in P0.2.
- **Change:** one core helper adds n centre runs (n may be 0) for every design type and distributes categorical centre runs across levels. Both generators and the augmentation actions call it. With no continuous factor it adds none and says so (DES-19). A categorical factor without levels is an input error (P1.10), never written as `undefined` (DES-20).
- **Where:** `src/core/design/` and both generators.
- **Accept when:**
  - A CCD with `centerPoints: 4` has 4 centre runs, in the UI and over MCP.
  - 0 is respected wherever the design allows it.
  - Categorical centre runs are balanced across levels.
  - An all-categorical factorial or custom D-optimal design gets no centre runs, in the UI and over MCP.
  - Custom D-optimal and fractional designs get the requested centre runs in core as in the UI.
  - Augmentation never writes `undefined` into `run.factors`.
- **Order:** after P0.2. Before P2.3.

#### P1.21 Optimizer accepts a target of 0

- **Covers:** STAT-10 (High, C), UI-10 (High, C). Logic, S.
- **Problem:** The Bayesian optimizer replaces a target of 0, or an empty field, with 70. A scientist targeting 0% impurity gets suggestions aimed at 70.
- **Evidence:** `src/web/features/optimization/ProjectOptimization.tsx:631` (`targetValue: Number(targetValue) || 70`), `:605` (default 70), `:798-799` (the input; placeholder "e.g. 70").
- **Change:** use a `Number.isFinite` check, and require a target when the goal is `target`.
- **Where:** `ProjectOptimization.tsx` (later P2.7).
- **Accept when:** a target of 0 reaches the optimizer as 0 (unit test of the options builder), and an empty target with goal `target` shows a validation message.
- **Order:** any time.

#### P1.22 Excel export that does not fail silently

- **Covers:** UI-8 (High, R), STAT-17 (Medium, C). Move-only PR, then logic PR. S.
- **Problem:** Export Excel does nothing, with no message, when a response name is longer than 22 characters, contains `[]:*?/\`, or shares its first 25 characters with another. Effect Tests hard-code Nparm = 1 and DF = 1.
- **Evidence:** `src/web/pages/ProjectView.tsx:347-348` (sheet name = first 25 characters + " Analysis", unsanitised), `:55` (`import('xlsx-js-style').then(...)` without `catch`), `:295-299` (Nparm 1, DF 1). `src/core/analysis/analysisCore.ts:619-620` has the real values.
- **Measured:** "Isolated Yield After Work Analysis" fails with "Sheet names cannot exceed 31 chars". "Purity [HPLC] Analysis" fails with the invalid-character error.
- **Change:**
  1. Move-only: move the Excel export to `src/web/features/export/excelExport.ts`.
  2. Logic: sanitise sheet names (≤ 31 characters, de-duplicated), add a `.catch` that shows an error, and write `ef.nparm` and `ef.df`.
- **Where:** `src/web/features/export/excelExport.ts`.
- **Accept when:**
  - "Isolated Yield After Work", "Purity [HPLC]" and two names sharing 25 characters all export, with unique valid sheet names.
  - A 3-level categorical term shows Nparm 2 and DF 2.
  - A failure shows a message.
- **Order:** any time.

#### P1.23 Residual plot download per response

- **Covers:** UI-13 (High, C). Logic, S.
- **Problem:** The residual plots look up hard-coded DOM ids. In Compare, every download saves the first response's plot, under a filename without the response name.
- **Evidence:** `src/web/shared/ResidualsPlots.tsx:10`, `:50`, `:83`, `:123` (fixed ids), `:35`, `:108` (filenames). `src/web/features/compare/CompareResponses.tsx:505-524`: one plot per response, so the ids repeat.
- **Change:** use `useRef` and put the response name in the filename. This becomes part of the shared PNG helper in P2.19.
- **Where:** `ResidualsPlots.tsx`.
- **Accept when:** in Compare with two responses, downloading the second plot saves that plot as `<project>_<response>_Actual_by_Predicted.png`, and no id repeats in the DOM.
- **Order:** any time.

## P2 — Medium: consolidation, enablers and tests

Each calculation should exist once, in `src/core`, with typed results. Several items here close High issues (P2.3, P2.5, P2.6, P2.8), so do those first within Phase 2.

| Item | Title | Covers | Phase | Type | Size | Status |
|---|---|---|---|---|---|---|
| P2.1 | Test harness, reference datasets and CI | BLD-4 | 1 | tooling | M | in progress (step 1 done in PR #3; step 2 open) |
| P2.2 | A declared package manager and Node version | BLD-7, SRV-6, BLD-13 | 3 | tooling | S | open (decision 1 settled: no lockfile) |
| P2.3 | One design generator | DES-8, MCP-19, UI-15 | 2 | logic | L | open |
| P2.4 | Design algorithm gaps | DES-9, DES-11, DES-12 | 2 | logic | M | open |
| P2.5 | One desirability and one optimum search | STAT-6, MCP-3, UI-5, MCP-11 | 2 | logic | M | open |
| P2.6 | One Monte Carlo | STAT-9, MCP-16, UI-9, DATA-15 | 2 | logic | M | open |
| P2.7 | Bayesian optimizer in core | STAT-13, UI-16, UI-30, STAT-19 | 2 | logic | L | open |
| P2.8 | Effect plots and surface grids in core | STAT-16, UI-6, UI-7, UI-18 | 2 | logic | M | open |
| P2.9 | Model-based effects | STAT-15, STAT-20 | 2 | logic | M | open |
| P2.10 | Diagnostics rules in core | UI-17, STAT-23 | 2 | logic | M | open |
| P2.11 | Run identity and run order | STAT-18, UI-24, DATA-20 | 2 | logic | S | open |
| P2.12 | Split `server.ts` | SRV-5, MCP-20 | 2 | move, then logic | M | open |
| P2.13 | Strict TypeScript and lint | BLD-9 | 2 | tooling | M | open |
| P2.14 | Typed API client and local cache | DATA-18, SRV-12 | 3 | logic | M | open |
| P2.15 | Seed once, never mutate samples | DATA-13, DATA-14 | 3 | logic | S | open |
| P2.16 | Schema version and migrations | DATA-12 | 3 | logic | M | open |
| P2.17 | Project domain operations | DATA-11, UI-27 | 3 | logic | M | open |
| P2.18 | Change history and audit trail | DATA-16, MCP-21 | 3 | logic | L | open |
| P2.19 | Shared analysis widgets | UI-19 | 4 | move, then logic | M | open |
| P2.20 | Routed tabs | UI-25, UI-26 | 4 | logic | S | open |
| P2.21 | Works over plain HTTP on a LAN | SRV-4, UI-22 | 4 | logic | S | open |

### P2.1 Test harness, reference datasets and CI

- **Covers:** BLD-4 (Medium, C). Tooling. Step 1 M, step 2 S.
- **Status (2026-10-21):** step 1 is done in PR #3. `npm test` runs vitest 4.1 on `tests/`: 118 passing tests, 38 expected failures (`it.fails`, named after STAT-1, STAT-2, STAT-3, STAT-4, STAT-5, STAT-21, MCP-1/UI-31, MCP-6, MCP-7, MCP-8 and MCP-9) and 2 `it.todo`. The case table (fixture, source, issue IDs, which backlog item flips each test) is in the [statistics engine doc](../../context/DOE-Magic/statistics-engine.md#reference-tests). Differences from the plan below:
  - Reference values are published examples (Montgomery, *Design and Analysis of Experiments*, 8th ed., Examples 6.1, 6.2, 8.1 and 11.2; Lenth 1989) plus statsmodels 0.14.4 OLS via `tests/fixtures/compute_reference.py`, because R was not installed (decision 5 is still open). The Lenth worked example is Montgomery's application of Lenth's method to Example 6.2 (PSE 2.625, ME 6.75, SME 13.70), not the example in Lenth's paper, which was not at hand; it is an `it.todo` until P0.4 adds a core Lenth function.
  - Added fixtures beyond the minimum set: an unreplicated 2^4 (Example 6.2, two models) and a real 6-factor DSD built from a conference matrix (rank-deficient, like PB12).
  - The design helpers (run counts, level balance, max |r|, resolution, D-efficiency) are not in this step; P0.11 adds them before it changes the generators. Seeded random rank-deficient 3-level designs are left to P0.3.
  - MCP tool tests cover `run_analysis` only (MCP-1, MCP-6 to MCP-9), through the SDK's `InMemoryTransport`.
  - No lockfile was updated: commit cc41f15 on `main` (2026-10-21, just after PR #1 merged) deleted both `package-lock.json` and `bun.lock`, so this PR changes `package.json` only. Decision 1 then settled on no lockfile (PR #4), so installs use `npm install`, never `npm ci` (see [decision 1](#open-decisions-for-the-owner)). Before that deletion, `npm install` added only vitest and its dependencies to `package-lock.json`, with Vite deduplicated at 6.4.3. bun is not installed here.
  - The `dist/` output is byte-identical to a build of `main` with the same `node_modules` (also checked against PR #1's build while its lockfile still existed).
- **Problem:** There are no automated tests and no CI. Every P0 statistics and design fix needs a pinned reference value, and today nothing catches a regression.
- **Evidence:** `package.json:6-13` has no `test` script. There are no `*.test.*` or `*.spec.*` files and no `.github/` directory.
- **Change, step 1 (the first PR after PR 0):**
  - Add `vitest` as a devDependency, compatible with Vite 6, and `"test": "vitest run"`.
  - Add a `vitest.config.ts` with the node environment. Do not reuse `vite.config.ts`, which loads the React and Tailwind plugins.
  - Tests live in a root `tests/` folder that mirrors `src/`, for example `tests/core/analysis/ols.test.ts`. Add `tests` to `tsconfig.json` `include` so `npm run check` type-checks them. Keep test files out of `src/`: the boundary checker rejects a `vitest` import under `src/core` (R3), and `src/` must stay free of non-app files.
  - Fixtures go in `tests/fixtures/` as JSON. Each records its provenance: the tool and version, or the publication, and the date. Minimum set:

    | Fixture | Purpose |
    |---|---|
    | Regular 2^(4−1) with centre points (full rank) | Baseline that is already correct |
    | PB12, 6 factors, 3 centre points, default model (rank-deficient) | P0.3 |
    | Saturated 2^(4−1), 8 runs, error DF 0; Lenth (1989) example | P0.4 |
    | 2×3 full factorial (3-level categorical), saturated | P0.5 |
    | Replicated design with pure error | Lack of fit |
    | CCD or BBD with known curvature | P0.9 |
    | Demo project `proj-suzuki-cross-coupling` (27 runs) | Characterization snapshot |

  - Invariant tests that need no external reference:
    - Σ leverage = rank, and every leverage is in [0, 1].
    - A rank-deficient fit equals the fit of the explicit reduced model.
    - Predictions at the design points equal the fitted values.
    - Coefficients do not depend on factor order.
  - Characterization tests snapshot today's output. Values known to be wrong are marked `test.fails('STAT-n …')`, so each fix flips exactly its own tests.
  - Design helpers: run counts, level balance, the maximum |r| between model columns, resolution from the alias structure, and D-efficiency units.
  - MCP tool tests use the SDK's `InMemoryTransport`.
- **Change, step 2:** `.github/workflows/ci.yml` runs `npm install`, `npm run check`, `npm test` and `npm run build` on every push and PR. No lockfile is tracked (decision 1), so CI cannot use `npm ci`. Print the installed versions of the packages the tests depend on (for example `npm ls jstat vitest vite`), so a red run caused by a dependency update can be told apart from a code change.
- **Where:** `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/`, `.github/workflows/ci.yml`.
- **Accept when:**
  - `npm test` runs the invariant and characterization suites, which are green except for the listed expected failures.
  - `npm run check` type-checks the tests.
  - CI fails on a deliberately broken test.
  - The `dist/` output does not change.
- **Order:** first. Decision 5 sets the reference tool.

### P2.2 A declared package manager and Node version

- **Covers:** BLD-7 (Medium, C), SRV-6 (Medium, R), BLD-13 (Medium, R). Tooling, S. SRV-6 and BLD-13 describe the same defect.
- **Problem:** No lockfile is tracked, by decision 1, so every install resolves the newest versions within the `package.json` ranges. Before that, two lockfiles drifted apart and `npm ci` broke once. No package manager or Node version is declared. The CommonJS server bundle `require()`s ESM-only `uuid` 14, so the production bundle needs a Node version with `require(esm)` on by default: 22.12 or newer, or 20.19 or newer on the 20.x line.
- **Evidence:** cc41f15 (2026-10-21) deleted `bun.lock` and `package-lock.json`, and `.gitignore` lists both since decision 1. `package.json` has no `engines` or `packageManager` field. `package.json:8` (`--format=cjs --packages=external`), `:41` (`uuid ^14.0.1`). The installed `uuid` 14.0.2 is `"type": "module"` and its `exports` have no `require` condition; `dist/server.cjs` contains two `require("uuid")` calls. The README already states Node 22.12+.
- **Measured:** `node --no-experimental-require-module dist/server.cjs` (Node 24.13.0 with `require(esm)` turned off, which simulates an older Node) fails at start-up with `ERR_REQUIRE_ESM` on `node_modules/uuid/dist-node/index.js`.
- **Change:**
  - Decision 1 is settled: npm, no lockfile. If it is reopened, commit one lockfile and switch CI to `npm ci` in the same PR.
  - Add `packageManager` and `engines.node`, matching the README.
  - Either bundle the server as ESM or keep CJS with the declared engine.
  - CI installs with `npm install` while no lockfile is tracked.
- **Where:** `package.json`, CI.
- **Accept when:**
  - `engines` matches the README.
  - `npm start` works on the minimum declared Node (CI matrix).
- **Order:** decision 1 is settled. AI Studio-sensitive. In the [suggested PR sequence](#suggested-pr-sequence) it sits in Phase 3 next to P1.2, which also changes the `package.json` scripts and the production start.

### P2.3 One design generator

- **Covers:** DES-8 (High, C), MCP-19 (Medium, C), UI-15 (Medium, C). Logic, L.
- **Problem:** The UI has its own copy of the design generator, and it has drifted from the core generator that MCP uses. The same request gives different designs in the browser and over MCP, and some UI paths output designs that do not match their label.
- **Evidence:**
  - `src/web/features/design/ProjectDesign.tsx:451-991` (`generateRuns`) versus `src/core/design/doeGenerator.ts:20-457`, which only `src/server/mcp/doeMcpServer.ts:273` and `:462` call.
  - The 2-level rule: `=== 2` (`ProjectDesign.tsx:147`) versus `<= 2` (`doeGenerator.ts:38`).
  - Three pMain formulas: `ProjectDesign.tsx:157-159`, `doeGenerator.ts:41-47`, `dOptimal.ts:124-127`.
  - The continuous BBD branch has no k < 3 guard: `ProjectDesign.tsx:750-781`.
  - PB fallback run count: `:834` versus `doeGenerator.ts:356`.
  - The planner (`ProjectDesign.tsx:144-183`) and augmentation (`:994-1085`) are embedded in the component.
- **Change:**
  1. Golden-output tests compare both paths for every design type. They record today's differences.
  2. `ProjectDesign` calls `generateDesign` and `randomize` (P1.19). Delete `generateRuns`.
  3. Move the planner and augmentation into core.
- **Where:** `src/core/design/doeGenerator.ts`, `planner.ts` and `augment.ts` (new); `ProjectDesign.tsx` becomes UI only.
- **Accept when:**
  - `generateRuns` is gone.
  - For each design type, the UI and MCP give the same runs for the same inputs and seed.
  - A BBD with k < 3 is refused or labelled as a fallback.
- **Order:** after P0.11, P0.12, P1.18, P1.19 and P1.20, which fix core first.

### P2.4 Design algorithm gaps

- **Covers:** DES-9 (Medium, R), DES-11 (Medium, R), DES-12 (Medium, C). Logic, M.
- **Problem:**
  - The D-optimal exchange is a deterministic point exchange: one fixed start, at most 3 passes, the full log-determinant recomputed per swap. It is labelled "coordinate exchange".
  - It finds poor local optima, and it freezes the browser for 9 or more factors.
  - Plackett-Burman holds factor 20 and beyond constant, and calls its categorical fallback an "orthogonal" array.
- **Evidence:**
  - `src/core/design/dOptimal.ts:147-157` (fixed start), `:164-198` (the exchange), `:106` and `ProjectDesign.tsx:1198` (the label).
  - `ProjectDesign.tsx:183` (default target 2^(k−1)) and `:923` (runs synchronously on the main thread).
  - `src/core/design/doeGenerator.ts:311` and `ProjectDesign.tsx:795`: index ≥ 19 is always low.
  - `doeGenerator.ts:349-361` and `ProjectDesign.tsx:828-846`: the fallback's notes.
- **Measured:** half fractions of 6, 7 and 8 factors took 0.05, 0.64 and 7.4 s in Node. Extrapolated, 9 factors would take about 1.5 min.
- **Change:**
  - Random restarts, rank-one updates and iteration to convergence; correct the label.
  - Generate in a Web Worker with progress and cancel.
  - Plackett-Burman sizes 24, 28 and up, or refuse with a message.
  - Honest notes for the categorical fallback.
- **Where:** `dOptimal.ts`, `doeGenerator.ts`, a worker wrapper in `src/web/features/design/`.
- **Accept when:**
  - On a fixture where an orthogonal design exists, the exchange reaches 100% D-efficiency for at least 95% of seeds.
  - The 9-factor case takes under 2 s in Node.
  - The UI stays responsive, and cancel works.
  - With 20 or more factors, every factor varies, or the generator refuses.
- **Order:** after P0.11 (regular fractions remove most D-optimal use) and P2.3.

### P2.5 One desirability and one optimum search

- **Covers:** STAT-6 (High, C), MCP-3 (High, C), UI-5 (High, C), MCP-11 (High, R). Logic, M. Contract change.
- **Problem:**
  - Three desirability formulas (analysis optimum, Profiler, MCP) give different answers for the same response, so scientists can get contradictory recipes.
  - The MCP grid search drops factors once it exceeds 20,000 combinations, saves candidates with missing factors, and blocks the event loop.
- **Evidence:**
  - Analysis optimum: `src/core/analysis/analysisCore.ts:757-782`. The comment says Derringer-Suich. Maximize uses `targetValue` as the upper anchor and minimize as the lower. Target is a triangle with tolerance 0.5 × the observed span, defaulting to the mean.
  - Profiler: `src/web/features/analysis/PredictionProfiler.tsx:13-40` (observed min/max anchors; `targetValue` ignored for maximize and minimize), `:77-84` (unweighted geometric mean), `:22` (the saved goal, not the override at `ProjectAnalysis.tsx:174` and `:182-183`).
  - MCP: `src/server/mcp/doeMcpServer.ts:815-853` and `:879-895`.
  - MCP search: `:856-867` (`break` above 20,000), `:898-901` and `:916-925` (missing factors).
- **Measured:** 5 numeric factors at 25 points: F5 was missing from the best recipe and the saved candidates, and the call took about 0.8 s synchronously.
- **Change:**
  - `src/core/optimization/desirability.ts`: Derringer-Suich one- and two-sided forms with explicit lower, target and upper limits and a weight per response. Overall D is the weighted geometric mean.
  - Limits are stored on `Response` (a data-format change; migration in P2.16; UI fields in P2.17).
  - The analysis optimum, the Profiler and MCP all use it, and MCP searches with `optimize.ts` from P0.8.
- **Where:** `src/core/optimization/`, `analysisCore.ts`, `PredictionProfiler.tsx`, `doeMcpServer.ts`.
- **Accept when:**
  - Unit tests pass against the Derringer & Suich (1980) formulas, at and between the limits.
  - The analysis optimum, the Profiler and MCP report the same D for the same project and settings (1e-9).
  - Every MCP candidate has every factor at any grid setting.
  - No MCP request blocks for more than the configured budget.
- **Order:** after P0.8.

### P2.6 One Monte Carlo

- **Covers:** STAT-9 (High, C), MCP-16 (Medium, R), UI-9 (High, C), DATA-15 (Medium, C). Logic, M.
- **Problem:**
  - The robustness simulation exists twice, with different maths and defaults.
  - Both understate spread: neither includes parameter uncertainty, and the UI leaves residual noise off by default.
  - The UI simulates newly added factors at 0.
  - Opening the tab writes the project, including histogram data.
  - "Cpk" is computed from the total SD, which makes it Ppk.
- **Evidence:**
  - UI: `src/web/features/robustness/RobustnessSimulation.tsx:60` (residual noise off), `:115-119` (unseeded `Math.random`), `:135`, `:210` (blank nominal → 0), `:137`, `:212` (missing SD → 0), `:172`, `:224` (variance divided by N), `:22-47` (settings initialised once; the saved copy wins), `:78-101` (debounced autosave of `robustnessState`, including `simulationResults`).
  - MCP: `src/server/mcp/doeMcpServer.ts:967` (claims "model uncertainty"), `:978` (noise on), `:993-998` (`Math.random`), `:1000` (N forced into 500–25,000), `:1014-1015` (missing nominal → midpoint, including categoricals), `:1047` (N − 1), `:1050-1062` ("Cpk").
- **Measured:** `numSimulations: 10` ran 500 simulations.
- **Change:**
  - `src/core/robustness/monteCarlo.ts` with an injectable seeded RNG.
  - Residual noise on by default. Optional parameter uncertainty, β ~ N(b, MSE·(X'X)⁻¹).
  - No ad-hoc clamping; documented defaults (centre or first level; SD 2% of the range), echoed in the result.
  - The index is reported as Ppk.
  - The UI merges saved settings with the current factors and warns about defaulted ones. It persists only inputs, on an explicit run, and keeps results in component state.
- **Where:** `src/core/robustness/monteCarlo.ts` (new), `RobustnessSimulation.tsx`, `doeMcpServer.ts`.
- **Accept when:**
  - The same inputs and seed give identical numbers in the UI and over MCP.
  - Residual noise is on by default.
  - A factor added after a run gets defaults and a warning, never 0.
  - Opening the tab does not change `updatedAt`.
  - `simulationResults` no longer appears in `data.json`.
  - The output says Ppk.
- **Order:** after P0.3, P0.7 and P1.11.

### P2.7 Bayesian optimizer in core

- **Covers:** STAT-13 (Medium, C), UI-16 (Medium, C), UI-30 (Low, C), STAT-19 (Medium, C). Logic, L.
- **Problem:**
  - The whole Gaussian-process optimizer (linear algebra, GP, EI and the Markdown report) lives inside a React component. It is unseeded, so it cannot be tested or reproduced.
  - It extrapolates 30% beyond the tested range by default, with overconfident intervals.
  - It treats categorical levels as ordinal, and reports max(Y) as "best observed" whatever the goal.
  - It rounds suggested settings to 2 decimals and appends them as runs.
  - Leftover LaTeX clean-up regexes remain.
  - The analysis optimum also rounds.
- **Evidence:**
  - `src/web/features/optimization/ProjectOptimization.tsx:23-593` (the optimizer and report builder), `:350` (`Math.random`).
  - `:606` (30% margin). `:284-285` (the uncertainty ignores trend-parameter variance), although `:296` calls the model "Universal Kriging". `:555-559` (y ± 1.96·u is labelled "95% Confidence Interval").
  - `:140-146`, `:180-183` (categorical index scaled as ordinal), `:226-228` (noise grid at most 0.1; σ_f fixed).
  - `:524` (max(Y)). `:347-358` (the negative clamp returns normalised 0, which is f.min). `:107-125` (ignores the analysis model and excluded terms).
  - `:571` (`toFixed(2)`), `:645-656` (rounded candidates appended).
  - `:666-678` (LaTeX clean-up; the builder emits plain Markdown).
  - `src/core/analysis/analysisCore.ts:865` (`optimalValue` rounded).
- **Change:**
  - `src/core/optimization/bayesOpt.ts` returns structured candidates and model information. Seeded RNG; default margin 0.
  - The variance includes the trend coefficients. Categoricals are one-hot in the trend. Fit or widen the noise hyperparameter.
  - "Best observed" follows the goal, and the interval is labelled "approximate prediction interval".
  - Store full precision; round only for display, by significant digits relative to the range, including at `analysisCore.ts:865`.
  - The UI renders the structured report through `t()`. Remove the LaTeX clean-up.
  - Appended runs use `uuid` and the run-order helper from P2.11.
- **Where:** `src/core/optimization/bayesOpt.ts` (new), `ProjectOptimization.tsx`, `analysisCore.ts`.
- **Accept when:**
  - The same data and seed give the same suggestions.
  - For a minimize goal, "best observed" is min(Y).
  - Default suggestions stay inside the tested bounds.
  - A 3-level categorical is one-hot encoded (unit test).
  - A 0.001–0.005 M factor keeps 4 significant digits in stored candidates.
  - No regex clean-up code remains.
- **Order:** after P1.21 and P2.11. Coordinate the storage of results with P1.16.

### P2.8 Effect plots and surface grids in core

- **Covers:** STAT-16 (Medium, C), UI-6 (High, C), UI-7 (High, C), UI-18 (Medium, C). Logic, M.
- **Problem:** Main-effect means, interaction means and surface grids are recomputed in Analysis, Compare and the export, and the copies disagree:
  - The Analysis interaction plot counts centre and axial points as "low". Compare excludes them and shows nothing for categoricals. The export counts them in both groups.
  - The main-effects plot matches level labels by index strings too, so with labels "1", "2", "3" a run counts in more than one level.
  - Surfaces hold a categorical factor at the floor of its index midpoint: the first level of a 2-level factor, the second of a 3-level one. The plot does not say so.
- **Evidence:**
  - Interaction means: `src/web/features/analysis/ProjectAnalysis.tsx:343-344`, `:353-354`, `:368-369` (`<= mid`); `src/web/features/compare/CompareResponses.tsx:124-152`; `src/web/features/export/htmlExport.ts:1138-1148`.
  - Level matching: `ProjectAnalysis.tsx:2044-2048` and `:2029-2036` (label, `String(lIdx)` or `String(lIdx + 1)`); `htmlExport.ts:473-479`.
  - Surface grids: `ProjectAnalysis.tsx:397-582`, `CompareResponses.tsx:160-319`, `htmlExport.ts:1223-1345`.
  - Index midpoint: `ProjectAnalysis.tsx:515-520` and `CompareResponses.tsx:263-268`, using the bounds 0..L−1 (`ProjectAnalysis.tsx:416-419`). `analysisCore.ts:64-66` floors the index.
  - Linear-trend fallbacks: `ProjectAnalysis.tsx:453-482`, `CompareResponses.tsx:206-232`, `ProjectOptimization.tsx:175`.
- **Change:**
  - New `src/core/analysis/effectPlots.ts`: `mainEffectMeans`, `interactionMeans` with explicit centre and axial handling, and one level-matching helper (exact label, normalised once).
  - Analysis, Compare and the export use it, and the `surfaceGrid` module from P0.10, with categorical factors held at a chosen, displayed level.
- **Where:** `src/core/analysis/effectPlots.ts` (new), the three consumers.
- **Accept when:**
  - Analysis, Compare and the export give identical interaction means for the demo project.
  - Centre points fall in neither the low nor the high group.
  - Labels "1", "2", "3" are never double-counted.
  - Compare shows categorical interaction plots.
  - Surfaces name the level each categorical factor is held at.
- **Order:** after P0.10.

### P2.9 Model-based effects

- **Covers:** STAT-15 (Medium, C), STAT-20 (Low, C). Logic, M. Contract change.
- **Problem:**
  - The effect of a categorical factor is the max − min of raw level means, and an unobserved level counts as an average of 0.
  - Interaction magnitudes use only the first contrast column.
  - Pareto and half-normal plot √F for multi-df terms and compare it with a 1-df t limit.
- **Evidence:** `src/core/analysis/analysisCore.ts:366-376` (raw level means; 0 for an unobserved level at `:369`), `:386-387` (dummy counts), `:367` versus `:62-66` (string matching versus index matching), `:437` (first column only), `:652`, `:663`, `:678`, `:646` (√F against the t limit), `src/web/features/analysis/ProjectAnalysis.tsx:1311` (Pareto colouring).
- **Change:**
  - Derive effects from the fitted model: LS means for categoricals, and Type III F with logworth per term.
  - An unobserved level gives `null`, not 0.
  - The half-normal plot shows 1-df effects only. Multi-df terms are ranked by logworth with their own F p-value.
- **Where:** `src/core/analysis/effects.ts` (new).
- **Accept when:**
  - An unobserved level is `null` and flagged.
  - A 3-level term's significance equals its Type III p < 0.05.
  - The half-normal plot holds only 1-df effects.
  - A 2-level categorical's Pareto magnitude equals |2β|.
- **Order:** after P0.4.

### P2.10 Diagnostics rules in core

- **Covers:** UI-17 (Medium, C), STAT-23 (Low, C). Logic, M.
- **Problem:**
  - About 470 lines of model-diagnostics rules, with inline bilingual text, live in `ProjectAnalysis.tsx`. They cannot be tested or offered over MCP.
  - "Key Drivers" sorts by a field that does not exist, and matches factors by name prefix.
- **Evidence:** `src/web/features/analysis/ProjectAnalysis.tsx:584-1053` (`renderDeterministicSummary`), `:745` (sorts by `ef.tRatio`; `effectSummary` has `fRatio`, see `analysisCore.ts:613-624`), `:761` (`effect.name.startsWith(fact.name)`: factor "T" matches "Temp").
- **Change:** `src/core/analysis/diagnostics.ts` returns `[{severity, code, params}]`, and the UI maps codes to `t()` keys. Sort by logworth and match by effect id.
- **Where:** `src/core/analysis/diagnostics.ts` (new), `ProjectAnalysis.tsx`.
- **Accept when:**
  - Each rule has a unit test at its threshold.
  - With factors "T" and "Temp", advice attaches to the right one.
  - `ProjectAnalysis.tsx` holds no rule thresholds.
- **Order:** after P0.4 and P0.5, whose semantics the rules use.

### P2.11 Run identity and run order

- **Covers:** STAT-18 (Medium, C), UI-24 (Medium, C), DATA-20 (Low, C). Logic, S.
- **Problem:** Residual diagnostics and run plots label runs by their position among the valid runs, not by run order, so "Run #5 is an outlier" can point at the wrong batch. Appended runs take `runs.length + i + 1`, which collides after deletions. Ids are generated three different ways.
- **Evidence:**
  - Labels: `src/core/analysis/analysisCore.ts:1041` (`run: idx + 1`), `src/web/features/analysis/ProjectAnalysis.tsx:660-661` (messages), `:386-394` and `src/web/features/compare/CompareResponses.tsx:155-157` (`Run ${i + 1}`).
  - Run order: `src/web/features/optimization/ProjectOptimization.tsx:649-651` and `src/web/features/design/ProjectDesign.tsx:1079` (`addEmptyRun`, part of DATA-20).
  - Ids: `src/web/pages/GuideView.tsx:156` (`step-${Date.now()}`).
  - `src/server/mcp/doeMcpServer.ts:543-546` matches the first run with a given order.
- **Change:** carry `run.id` and `runOrder` into residual and plot data, and label by `runOrder`. A core ids helper uses uuid v4 and `nextRunOrder = max + 1`. Validation enforces unique run orders (P1.10).
- **Where:** `src/core/ids.ts` (new), `analysisCore.ts`, the plot consumers.
- **Accept when:**
  - With run 3 missing a response, the outlier message names the true run order.
  - The DOE Mean x-axis is the run order.
  - Appending after a deletion gives unique run orders.
- **Order:** before P2.7.

### P2.12 Split `server.ts`

- **Covers:** SRV-5 (Medium, C), MCP-20 (Medium, C). Step 1 move-only, step 2 logic. M.
- **Problem:**
  - `server.ts` is an untyped monolith that mixes the store, seeding, REST, socket.io, MCP mounting and the Vite bootstrap.
  - Upsert logic is written six times.
  - `stdio.ts` copies the store bootstrap, and the copies have drifted: stdio seeds only an empty store, does not set `updatedAt`, and has a no-op broadcast.
- **Evidence:**
  - `server.ts:25` (`let db: any`), `:24-68` (store), `:70-120` (socket), `:128-217` (REST), `:222-363` (MCP), `:365-392` (bootstrap).
  - Upserts: `server.ts:78-87`, `:95-104`, `:137-151`, `:166-180`, `:225-235`; `src/server/mcp/stdio.ts:43-51`.
  - The stdio copy: `stdio.ts:8-58` versus `server.ts:9-68` and `:222-243`.
- **Change:**
  1. Move-only: split into `src/server/store/jsonFileStore.ts`, `src/server/routes/`, `src/server/realtime/socket.ts` and `src/server/mcp/http.ts`. Root `server.ts` stays as a thin entry, for AI Studio.
  2. Logic: a typed store that implements `McpDatabaseContext`, shared by `server.ts` and `stdio.ts`, with one seeding, migration and save path.
- **Where:** `src/server/`.
- **Accept when:**
  - Step 1: the smoke snapshot used for PR 0 (REST, MCP over HTTP including `run_analysis` on the demo, stdio MCP, dev-mode Vite) is identical, `npm run check` passes (R4, R7), and `server.ts` only wires modules together.
  - Step 2: stdio and the server write identical `data.json` for the same tool calls, and `db` is no longer `any`.
- **Order:** step 1 early in Phase 2 (it enables P1.1, P1.5–P1.7 and P1.15). Step 2 before P1.6.

### P2.13 Strict TypeScript and lint

- **Covers:** BLD-9 (Medium, R). Tooling, M.
- **Problem:** TypeScript is not strict and there is no linter, so type errors such as a null analysis or a wrong goal string reach users. Dead code piles up unseen.
- **Evidence:** `tsconfig.json` has no `strict`, `noUnusedLocals` or `noUnusedParameters`. `tsc --noEmit --noUnusedLocals` reported 37 errors. There are 161 occurrences of `: any`, `as any` or `<any>` in `src/`. `@ts-ignore` appears at `src/web/features/analysis/ProjectAnalysis.tsx:11` and `src/server/mcp/doeMcpServer.ts:1352`, `:1373`, `:1395`, `:1412`.
- **Change:**
  - Turn on `strict` for `src/core` first (a separate tsconfig or project reference), then `src/server`, then `src/web`.
  - Turn on `noUnusedLocals` and `noUnusedParameters` as a later step, once P3.4 (core) and P3.3 (web) have removed the dead code.
  - Optionally add ESLint with `react-hooks`.
- **Where:** `tsconfig.json` (AI Studio-sensitive: edit it, do not move it), `package.json`.
- **Accept when:** `src/core` compiles under `strict` in `npm run check`. After the later step, a new unused local fails the check.
- **Order:** after P0.5 (typed analysis result). The `noUnusedLocals` step waits for P3.3 and P3.4.

### P2.14 Typed API client and local cache

- **Covers:** DATA-18 (Low, C), SRV-12 (Low, C). Logic, M.
- **Problem:**
  - `ProjectContext` mixes state, HTTP, socket and localStorage.
  - The cache uses unversioned keys, swallows quota errors, and replaces the whole cache with samples if one entry is invalid.
  - Root-absolute asset and API paths contradict Vite `base: './'`, so the app works only at a domain root.
- **Evidence:**
  - `src/web/state/ProjectContext.tsx:21-22` (keys), `:28-46` (one invalid entry → samples at `:46`), `:178-180` (an empty `catch`).
  - `vite.config.ts:8` (`base: "./"`) versus `index.html:7-8` (`/logo.png`, `/plotly.min.js`).
  - `ProjectContext.tsx:82`, `:103`, `:127-131` (`/api/...` and the default socket path); `src/web/features/mcp-panel/McpModal.tsx:54`.
- **Change:**
  - `src/web/state/api.ts`: a typed REST and socket client that checks `res.ok`, with the base URL from `import.meta.env.BASE_URL`, or document root-only hosting.
  - `src/web/state/localCache.ts`: versioned keys, migrated from the old ones; per-entry validation; quota errors surfaced.
  - `ProjectContext` holds state only.
- **Where:** `src/web/state/`.
- **Accept when:**
  - There is no `fetch(` or `io(` in `ProjectContext.tsx`.
  - One invalid cached project is dropped and the others are kept.
  - A quota error shows a warning.
  - Sub-path hosting works, or the README states root-only hosting.
- **Order:** before P1.8 and P1.7.

### P2.15 Seed once, never mutate samples

- **Covers:** DATA-13 (Medium, C), DATA-14 (Medium, R). Logic, S.
- **Problem:**
  - The server re-adds deleted sample projects on every start, and clients re-add the demo to their cache.
  - An empty server is refilled from a browser's cache, and clients ignore an empty project list.
  - Sample constants are shared by reference and changed in place, so "reset" restores an already-edited sample.
- **Evidence:**
  - Re-seeding: `server.ts:40-56`; `src/web/state/ProjectContext.tsx:34-35`, `:56-57`.
  - Empty server: `ProjectContext.tsx:89`, `:96-115`, `:136`.
  - Shared samples: `src/core/sampleProject.ts:297-299` (built once at module load); `server.ts:38`, `:43`. The reset no longer uses them since P0.1.
  - In-place mutation: `src/server/mcp/doeMcpServer.ts:350-355`, `:469-472`; `ProjectContext.tsx:173`. (`loadDemoProject` saved the shared module object until P0.1.)
- **Measured:** after `update_project` renamed the demo, a reset built from `[...sampleProjects]` (the pre-P0.1 `server.ts:196`) still showed "EDITED BY MCP". Since P0.1 the reset builds new objects and restores the original name (re-run 2026-10-21).
- **Change:**
  - Seed only on first run, with a `seeded` flag in the store.
  - An empty list is valid state, and the client never pushes its cache to the server implicitly.
  - Seed from `createSampleProjects()` / `createSampleFolders()` (`sampleProject.ts:289-295`, added in P0.1), which return new deep copies on every call.
  - Tools and `saveProject` work on copies and never mutate their inputs.
- **Where:** `src/core/sampleProject.ts`, `src/server/store/`, `ProjectContext.tsx`, `doeMcpServer.ts`.
- **Accept when:**
  - A deleted demo stays deleted after a restart.
  - Deleting the last project reaches every client.
  - Reset after an MCP rename restores the pristine sample (met since P0.1).
  - A unit test shows that inputs are unchanged after `saveProject` and tool calls.
- **Order:** after P2.12 step 1.

### P2.16 Schema version and migrations

- **Covers:** DATA-12 (Medium, C). Logic, M. Contract change.
- **Problem:** No version exists anywhere: not in `data.json`, localStorage keys, `Project` or exports. The only "migration" is a hard-coded legacy-id purge, copied into three places.
- **Evidence:** `src/core/types.ts:37-53`. The purge: `server.ts:59-60`, `src/server/mcp/stdio.ts:29-30`, `src/web/state/ProjectContext.tsx:31`, `:55`.
- **Change:**
  - `schemaVersion` in the store file, in `Project` and in the export envelope.
  - A `migrate(db)` pipeline in core, run by the server, stdio, the client cache and JSON import.
  - Migration 1 is the legacy purge.
  - Back up before migrating.
- **Where:** `src/core/migrations.ts` (new).
- **Accept when:**
  - A file without a version migrates to the current version, and a backup exists.
  - Each migration has a test.
  - The purge ids appear only in `migrations.ts`.
- **Order:** first in Phase 3, before any change to an existing persisted field (P1.7, P2.5 limits, P2.17 term ids).

### P2.17 Project domain operations

- **Covers:** DATA-11 (Medium, C), UI-27 (Medium, C). Logic, M.
- **Problem:**
  - Deleting a factor or response leaves its keys in runs, `excludedTerms`, `robustnessState` and `optimizationCandidates`.
  - Changing a factor's type or renaming a level does not remap run values.
  - Interaction ids depend on factor order.
  - MCP accepts any `folderId`.
  - The Setup form accepts min ≥ max, mangles typed target values, and cannot set desirability limits for maximize or minimize.
- **Evidence:**
  - `src/web/features/setup/ProjectSetup.tsx:60-80` (type and level edits), `:141-143`, `:161-163` (deletes).
  - `src/server/mcp/doeMcpServer.ts:352` (any `folderId`), `:354` (`designType` changed without regenerating).
  - `src/core/analysis/analysisCore.ts:278-279` (order-dependent interaction ids).
  - `ProjectSetup.tsx:66-67`, `:121-122` (defaults 0 and 100; no min < max check).
  - `:454`: the target is stored as `Number(v)` on each keystroke, so "-" becomes NaN and "1." becomes 1.
  - `:153`, `:443`: a target only for goal `target`, while `analysisCore.ts:765-772` uses it as the bound for maximize and minimize.
- **Change:**
  - `src/core/projectOps.ts`: `removeFactor`, `removeResponse`, `changeFactorType`, `renameLevel` and `reorderFactors`, each updating every dependent field.
  - Order-independent interaction ids, with a migration of saved `excludedTerms` (P2.16).
  - Validate `folderId` in MCP.
  - Setup inputs stay strings until blur, and are validated.
  - Desirability limits for every goal (with P2.5).
- **Where:** `src/core/projectOps.ts` (new), `ProjectSetup.tsx`, `doeMcpServer.ts`.
- **Accept when:**
  - Each operation has a test that finds no orphan keys.
  - Renaming a level remaps the run values.
  - min ≥ max is rejected with a message.
  - "-1.5" and "2.75" can be typed into target fields.
  - An unknown `folderId` returns an error.
- **Order:** after P2.16. With P2.5.

### P2.18 Change history and audit trail

- **Covers:** DATA-16 (Medium, C), MCP-21 (Medium, C). Logic, L.
- **Problem:**
  - Projects carry only `createdAt` and `updatedAt`. Every write replaces the whole object, with no record of who changed what.
  - The MCP "audit log" is an in-memory, per-process, 100-entry buffer with fake durations. It is served without authentication.
- **Evidence:**
  - `src/core/types.ts:37-53`; `server.ts:62-68`.
  - The log: `src/server/mcp/doeMcpServer.ts:17-41`. Resources log a fixed `durationMs: 5` (`:1153-1159`, `:1183-1189`, `:1215-1221`). Prompts are not logged (`:1239-1311`).
  - `server.ts:361-363`: `/api/mcp/logs`.
- **Change:**
  - Now: call it an "activity log" in the UI and the docs.
  - Then, per decision 6: an append-only change log in the store (entity, patch or before/after, actor, timestamp, channel: ui, mcp or import), a per-project history view, and scheduled backups.
  - Actor identity once P1.1 exists.
- **Where:** `src/server/store/changeLog.ts` (new), `src/server/mcp/activityLog.ts`, a history view in `src/web/`.
- **Accept when:**
  - Every write through REST, socket or MCP creates exactly one change-log entry.
  - The history view shows who, what and when.
  - The log survives a restart.
  - No UI text calls the activity log an audit log.
- **Order:** after decision 6, P1.5 and P1.7.

### P2.19 Shared analysis widgets

- **Covers:** UI-19 (Medium, C). Step 1 move-only, step 2 logic. M.
- **Problem:** Analysis and Compare duplicate the help tooltip, the PNG download, the stat tables, the effects plot and the Plotly factory. The help text has already drifted.
- **Evidence:**
  - Tooltip: `src/web/features/analysis/ProjectAnalysis.tsx:32-115` and `src/web/features/compare/CompareResponses.tsx:14-97`.
  - Lack-of-fit help text differs: `ProjectAnalysis.tsx:1851-1854` versus `CompareResponses.tsx:852-853`.
  - PNG download, four times: `ProjectAnalysis.tsx:119-165` (named `handleDownloadSvg` but saves PNG), `CompareResponses.tsx:331-371`, `src/web/shared/ResidualsPlots.tsx:9-41` and `:82-115`.
  - Plotly factory: `ProjectAnalysis.tsx:10`, `CompareResponses.tsx:12`.
- **Change:**
  1. Move-only: move the Analysis copies into `src/web/shared/` (`HelpTooltip.tsx`, `downloadPng.ts`, `plotly.ts`, `stats/`).
  2. Logic: Compare uses them, and its copies are deleted.
- **Where:** `src/web/shared/`.
- **Accept when:**
  - `src/web` has one tooltip component and one `createPlotlyComponent` call.
  - Help text is identical in both tabs.
  - R6 holds.
- **Order:** after P1.23.

### P2.20 Routed tabs

- **Covers:** UI-25 (Medium, P), UI-26 (Medium, R). Logic, S.
- **Problem:**
  - The active tab and the selected response live in component state, so a tab cannot be linked and a reload returns to Setup.
  - Tab components have no `key={project.id}`, so state could carry over between projects; this was not reproduced.
  - The Guide's "launch module" buttons ignore the target tab and open the first project.
- **Evidence:** `src/web/pages/ProjectView.tsx:21-22` (state), `:485-490` (no key), `src/web/App.tsx:23` (route `project/:id` only), `src/web/pages/GuideView.tsx:78` (`projects[0]`), `:265-271` (the target is ignored), `:618`, `:627`.
- **Change:** a `/project/:id/:tab` route, `key={project.id}`, the last-opened project tracked in context, and the Guide navigating to `/project/<last>/<target>`.
- **Where:** `App.tsx`, `ProjectView.tsx`, `GuideView.tsx`, `src/web/state/`.
- **Accept when:**
  - A reload keeps the tab, and a deep link opens it.
  - The Guide opens the target tab of the last-opened project.
  - Switching projects resets tab state.
- **Order:** any time in Phase 4.

### P2.21 Works over plain HTTP on a LAN

- **Covers:** SRV-4 (Medium, C), UI-22 (Medium, C). Logic, S.
- **Problem:** `crypto.randomUUID` and `navigator.clipboard` exist only in secure contexts. Opened as `http://<LAN-IP>:3000`, "Append suggestions" and the MCP copy buttons throw. Inferred, not reproduced in a browser.
- **Evidence:** `src/web/features/optimization/ProjectOptimization.tsx:651` (`crypto.randomUUID`), `src/web/features/mcp-panel/McpModal.tsx:46` (`navigator.clipboard.writeText`, unguarded), `server.ts:389` (`0.0.0.0`).
- **Change:** use `uuid` v4 everywhere, and guard the clipboard with a fallback.
- **Where:** the two files above.
- **Accept when:** `src/web` has no `crypto.randomUUID`; the copy buttons work without the clipboard API; a manual check on a LAN IP passes.
- **Order:** any time. Decision 3 sets how much LAN use matters.

## P3 — Low: i18n, dead code, dependencies, versions, payload

| Item | Title | Covers | Phase | Type | Size | Status |
|---|---|---|---|---|---|---|
| P3.1 | All UI text through `t()` | I18N-1, I18N-4, I18N-5, I18N-6 | 4 | logic, per feature | L | open |
| P3.2 | Exports in the user's language, one dictionary | I18N-2, I18N-3 | 4 | logic | M | open |
| P3.3 | Remove dead UI code, fix memo dependencies | UI-32, UI-28, UI-29, UI-33 | 4 | logic | S | open |
| P3.4 | Remove dead statistics code | STAT-24, STAT-25 | 2 | logic | S | open |
| P3.5 | PRESS and predicted R² | STAT-22 | 2 | logic | S | open |
| P3.6 | Unused dependencies and template leftovers | BLD-5, BLD-10, BLD-11, SRV-11 | 4 | logic | S | open |
| P3.7 | One version source | BLD-8 | 4 | logic | S | open |
| P3.8 | Smaller payload, one Plotly | BLD-6, UI-21 | 4 | logic | M | open |
| P3.9 | Server and config polish | SRV-7, SRV-8, SRV-10, SRV-14, BLD-12 | 4 | logic | S | open (`PORT` and `hmr: false` done in the owner's commit cc41f15) |
| P3.10 | Repo hygiene | BLD-14 | 0 (now) | chore | S | open (`.baseline-dist/` part done) |
| P3.11 | Design generator polish | DES-14, DES-15, DES-16, DES-18 | 2 | logic | M | open |
| P3.12 | MCP server hygiene | MCP-23 | 2 | logic | S | open |
| P3.13 | SOP steps on the server | DATA-19 | 4 | logic | S | open |

### P3.1 All UI text through `t()`

- **Covers:** I18N-1 (Medium, R), I18N-4 (Medium, C), I18N-5 (Low, R), I18N-6 (Low, C). Logic, one PR per feature. L in total.
- **Problem:**
  - About 600 inline bilingual branches bypass the dictionary, and many strings are English-only.
  - 133 of the 187 keys are unused, and some describe features that do not exist.
  - The locale plumbing has loose ends: empty locales, an `||` fallthrough, unused params, and the version in the dictionary.
- **Evidence:**
  - 533 `locale === 'zh'` occurrences in `src/web` (grep, 2026-10-20) and 54 `currentLang === 'zh'` in `src/web/features/export/htmlExport.ts`.
  - Only 6 files call `t()`: `Layout`, `Dashboard`, `ProjectView`, `ProjectSetup`, `LanguageSelector`, `GuideView`.
  - English-only strings: `src/web/shared/PlotlyErrorBoundary.tsx:45-49`, `src/web/features/robustness/RobustnessSimulation.tsx:107`, `src/web/features/compare/CompareResponses.tsx:365`, `src/web/features/analysis/ProjectAnalysis.tsx:1851-1854`.
  - Unused keys, for example `src/web/i18n/translations.ts:83`, `:122`, `:153`, `:157`.
  - Locale plumbing: `translations.ts:1`, `:448-451`; `src/web/i18n/LanguageContext.tsx:17`, `:44`, `:46-50`; `translations.ts:20`, `:235`.
- **Change:**
  - Migrate one feature per PR to `t(key, fallback, params)` under design spec §8, reusing existing keys.
  - Add `scripts/check-i18n.mjs` to `npm run check`. It reports unused and missing keys, and new locale ternaries.
  - Restrict `SupportedLocale` to `en | zh` and use `??`. The version leaves the dictionary in P3.7.
- **Accept when** (for each migrated feature):
  - Its folder has no `locale === 'zh'`.
  - The check script passes.
  - Switching language changes every visible string in it.
- **Order:** after the logic extractions for that feature (P2.7, P2.10), so text is not migrated twice.

### P3.2 Exports in the user's language, one dictionary

- **Covers:** I18N-2 (Medium, R), I18N-3 (Medium, C). Logic, M.
- **Problem:** The HTML export ignores the UI language. Excel labels and the persisted optimisation report are English-only. The export has its own dictionary, and design-type names are defined three times.
- **Evidence:** `src/web/pages/ProjectView.tsx:356` (`generateExportHTML(project)` without a locale), `src/web/features/export/htmlExport.ts:6` (defaults to `'en'`), `:43-45` (English month names), `ProjectView.tsx:54-353` (Excel labels), `src/web/features/optimization/ProjectOptimization.tsx:517-592` and `:636` (the report), `htmlExport.ts:321-408` (its own dictionary), `:32-40` and `ProjectView.tsx:56-63` (design-type names).
- **Change:**
  - Pass the locale to the export.
  - Excel labels come from the dictionary.
  - The report's i18n block is generated from `translations.ts`.
  - Design-type names become `design_type_<id>` keys (with P3.11).
- **Accept when:** with the UI in Chinese, the HTML report opens in Chinese and the Excel headers are Chinese, and design-type names are defined once.
- **Order:** after P1.22, P2.7 and P0.10.

### P3.3 Remove dead UI code, fix memo dependencies

- **Covers:** UI-32 (Medium, C), UI-28 (Low, R), UI-29 (Low, C), UI-33 (Low, C). Logic, S. UI-32 is Medium but sits here because its fix is the same memo clean-up as UI-29.
- **Problem:**
  - Unused imports, variables and context members hide real problems.
  - A memo dependency is stale, so the auto-picked top interaction can lag behind exclusions.
  - The active response is fitted twice on every edit.
  - When the active response has no saved `excludedTerms`, Analysis refits every response on every render, because the fallback `[]` is a new array each time and both fitting memos depend on it (UI-32).
  - A dead comparison in the sidebar's folder highlight can never match (UI-33).
- **Evidence:**
  - `tsc --noEmit --noUnusedLocals` reported 37 errors, for example `src/web/features/analysis/ProjectAnalysis.tsx:5` and `:12-13`.
  - `:24-27`: an empty comment block.
  - `src/web/state/ProjectContext.tsx:73`, `:307` (`socket` has no consumers) and `:74` (`loading` is never set true). `loadDemoProject` has callers since P0.1.
  - `src/web/pages/GuideView.tsx:23`, `:86-97`.
  - `ProjectAnalysis.tsx:283-383` (`interactionData` reads `analysisResults` at `:291`; it is missing from the dependencies at `:383`) and `:257-281` (two fits).
  - UI-32: `ProjectAnalysis.tsx:180` (`activeResponse?.excludedTerms || []`), a dependency of the memos at `:271` and `:281`. Any Analysis state change (plot type, table tab, axis select) reruns `computeAnalysis` for every response. The demo project has no saved `excludedTerms`.
  - UI-33: `src/web/Layout.tsx:99` compares `location.pathname` with `` `/?folder=${folder.id}` ``, which a pathname never contains; the `location.search` check on the same line does the work.
- **Change:** delete the dead code, including the pathname comparison. Derive `analysisResults` from `allAnalysisResults`, give the empty `excludedTerms` fallback a stable identity (a module constant or `useMemo`), and fix the dependency list.
- **Accept when:**
  - `tsc --noUnusedLocals` is clean for `src/web`.
  - The active response is fitted once per change (counted in a test).
  - Changing the plot type in Analysis does not call `computeAnalysis` (counted in a test).
- **Order:** before turning on `noUnusedLocals` in P2.13.

### P3.4 Remove dead statistics code

- **Covers:** STAT-24 (Low, C), STAT-25 (Low, C). Logic, S.
- **Problem:**
  - A fallback predictor uses the first contrast for every column of a 3+ level categorical. No current caller reaches it.
  - Other parts of the engine are unreachable, unused or duplicated.
- **Evidence:** `src/core/analysis/analysisCore.ts`:
  - `:1245-1292`: the fallback; `:1253-1254` uses `contrasts[0]`.
  - `:543-546`: an unreachable pure-error fallback.
  - `:566`: `paretoThreshold` is returned, and nothing outside `analysisCore.ts` reads it.
  - `:634-644`: `stdErrors` is used only as a fallback.
  - `:5-48`: `normSInv` duplicates `jStat.normal.inv`.
  - `:1093`: the loop variable `k` shadows the factor count.
  - `src/core/design/dOptimal.ts:1-2`: `jStat` is imported and unused.
- **Change:** delete them once the typed result (P0.5) and the reference suite exist.
- **Accept when:** the reference and characterization suites show no output change, and `predictModelResponse` takes a typed input with no fallback branch.
- **Order:** after P0.3, P0.4, P0.5 and P2.9.

### P3.5 PRESS and predicted R²

- **Covers:** STAT-22 (Low, C). Logic, S.
- **Problem:** There is no PRESS and no predicted R², so overfitting is judged only by the gap between R² and adjusted R². The model p-value is delivered by P0.5.
- **Evidence:** `src/core/analysis/analysisCore.ts:468-480` (F, no p-value), `:1153-1184` (the result fields).
- **Change:** PRESS = Σ(eᵢ/(1 − hᵢᵢ))², and predicted R² = 1 − PRESS/SST, both from the corrected leverages.
- **Accept when:** both values match a reference computed from R `hatvalues()` on two fixtures.
- **Order:** after P0.3 and P0.5.

### P3.6 Unused dependencies and template leftovers

- **Covers:** BLD-5 (Medium, C), BLD-10 (Low, C), BLD-11 (Low, C), SRV-11 (Low, C). Logic, S. AI Studio-sensitive.
- **Problem:**
  - Unused packages slow installs, widen the attack surface, and suggest Gemini, PDF export or animation that the app does not have.
  - The package is still named after the template, the page title says "Remix", and "Axiom" names remain.
- **Evidence:**
  - Never imported (grep of `src/`, `server.ts`, `vite.config.ts`): `@google/genai`, `dotenv`, `plotly.js-dist-min`, `jspdf`, `jspdf-autotable`, `motion`, `clsx`, `tailwind-merge`, `autoprefixer`, `sharp`.
  - `vite` is listed twice (`package.json:42`, `:58`). `@types/uuid` ^10 is listed, but `uuid` 14 ships its own types.
  - Gemini: `metadata.json:5-7`, `.env.example:1-2`, `server.ts:122`.
  - Template names: `package.json:2` (`react-example`), `index.html:6`, `:10` ("Remix DOE Magic …"), `src/web/pages/GuideView.tsx:21` (`axiom_doe_sop_steps_v1`), `src/web/features/export/htmlExport.ts:84` ("Axiom DOE Export"), `src/web/App.tsx:1-4` (template licence header).
- **Change:**
  - Remove the unused packages in one PR (`package.json` only; no lockfile is tracked, decision 1).
  - Remove Gemini only after decision 2, tested in a scratch AI Studio import.
  - Rename the package to `doe-magic`, and fix the title and fallback text.
  - Migrate the SOP storage key; renaming it without a migration orphans saved steps.
- **Accept when:**
  - grep finds no import of a removed package.
  - The build succeeds and the bundle does not grow.
  - The AI Studio import runs.
  - Existing SOP steps survive the key change.
- **Order:** after decision 2 (decision 1 is settled).

### P3.7 One version source

- **Covers:** BLD-8 (Medium, R). Logic, S. AI Studio-sensitive.
- **Problem:** "1.5.2" is hard-coded in 10 places in 7 files, while `package.json` says 0.0.0.
- **Evidence:** the 10 places: `index.html:6`, `:10`; `metadata.json:2`; `server.ts:340`; `src/server/mcp/doeMcpServer.ts:50`, `:1345`; `src/web/features/mcp-panel/McpModal.tsx:213`; `src/web/i18n/translations.ts:20`, `:235`; `src/web/Layout.tsx:64` (grep of tracked files, excluding lockfiles and `docs/`, 2026-10-20). `package.json:4` holds `0.0.0`.
- **Change:**
  - Make the `package.json` version the source: the server and MCP read it, and the client gets it through a Vite `define`.
  - Update `metadata.json` and `index.html` in a documented release step.
- **Accept when:** grep finds "1.5.2" only in `package.json` and the files the release step updates, and the UI, MCP `serverInfo` and `/api/mcp/info` agree.
- **Order:** after P3.12, which already gives the MCP server one constant for its name and version (Phase 2). This item then makes `package.json` the source for that constant and for the client (Phase 4).

### P3.8 Smaller payload, one Plotly

- **Covers:** BLD-6 (Medium, R), UI-21 (Medium, C). Logic, M.
- **Problem:**
  - About 7 MB loads before the dashboard is usable.
  - The exported report needs internet CDNs (Plotly 2.27.0 and the Tailwind Play CDN), while the app vendors Plotly 3.7.0.
- **Evidence:**
  - Build of 2026-10-20: main chunk 2,002,786 B; lazy `xlsx` chunk 870,219 B; CSS 116,400 B.
  - `index.html:8`: a render-blocking `/plotly.min.js` (4,855,045 B, v3.7.0).
  - `src/web/features/design/ProjectDesign.tsx:7`: a static `xlsx` import.
  - `src/web/pages/ProjectView.tsx:1`: a static import of the export, which embeds the 197 kB `logoBase64.ts`.
  - `public/logo.png` and `src/web/assets/logo.png` are identical (147,719 B each), and the favicon is the same file.
  - `htmlExport.ts:53-54`: the CDN scripts.
- **Change:**
  - Lazy-load the tab components and the export.
  - Load Plotly on demand.
  - Import `xlsx` dynamically, load the logo by URL, and shrink the favicon.
  - Either inline the report's styles and Plotly, or pin the CDN to the app's Plotly version and state in the report that it needs network access.
- **Accept when:**
  - The first page load no longer blocks on Plotly.
  - The main chunk is smaller, by an amount recorded in the PR.
  - The report renders offline, or says that it needs network access.
- **Order:** after P1.3 (one SheetJS).

### P3.9 Server and config polish

- **Covers:** SRV-7 (Low, C), SRV-8 (Low, C), SRV-10 (Low, R), SRV-14 (Low, R), BLD-12 (Low, C). Logic, S. AI Studio-sensitive.
- **Problem:**
  - Unknown `/api` and `/mcp` GETs return `index.html` with 200, and 500 responses echo internal error messages.
  - `.env` is never loaded, and every path depends on `process.cwd()`. The port was hard-coded until cc41f15.
  - With `PORT` set to anything but 3000 (outside Cloud Run), the HMR `clientPort` stays 3000, so the browser dials the wrong port for hot reload (SRV-14).
  - `DISABLE_HMR=true` still leaves an HMR socket. Before cc41f15 the inline `hmr` object probably overrode it (inferred from Vite's merge rules, not run). Since cc41f15 it passes `hmr: false`, and in middleware mode Vite then opens its own WebSocket server on port 24678 and points the client at it (run on 2026-10-21).
  - An unused `@` alias contradicts rule R2.
- **Evidence:** `server.ts:384-386` (the SPA fallback), `:266`, `:291`, `:308` (`err.message`), `:8` (`PORT`), `:369` (`clientPort` 443 or 3000), `:9`, `:382`; `src/server/mcp/stdio.ts:8`; `package.json:22` (`dotenv`); `vite.config.ts:15-21` versus `server.ts:370-379`; `vite.config.ts:10-14` and the `tsconfig.json` `paths`. Run on 2026-10-21 (Vite 6.4.5): with `PORT=3100`, `/@vite/client` holds `hmrPort = 3000`; with `PORT=3101 DISABLE_HMR=true`, the server port refuses a `vite-hmr` WebSocket, `/@vite/client` holds `hmrPort = 24678`, and a `vite-hmr` WebSocket opens on 24678.
- **Change:**
  - A JSON 404 for `/api` and `/mcp` ahead of the SPA fallback. Generic 500 bodies, with details logged.
  - Done in cc41f15: `PORT` from the environment, defaulting to 3000 (`Number(process.env.PORT) || 3000`).
  - Outside Cloud Run, `clientPort` is the listening port, not 3000 (SRV-14).
  - The data path from `DOE_DATA_FILE`, or the repo root, not the cwd.
  - Import `dotenv/config`, or drop it (P3.6).
  - Done in cc41f15: `hmr: process.env.DISABLE_HMR === 'true' ? false : {…}` in `server.ts`. Still to do: with `DISABLE_HMR=true`, also pass `ws: false` (a Vite 6 server option that the installed 6.4.5 has; not tried yet) so that no socket opens. Leave the `vite.config.ts` block alone.
  - Remove the alias and `paths`, after one AI Studio check.
- **Accept when:**
  - In production, `GET /api/nope` returns a JSON 404.
  - 500 bodies carry no internal text.
  - `PORT=3100 npm run dev` listens on 3100 (met since cc41f15), and its `/@vite/client` dials HMR on 3100.
  - A start from another directory uses the configured data file.
  - With `DISABLE_HMR=true`, no HMR socket is served, on the server port or on 24678.
- **Order:** after P2.12 step 1.

### P3.10 Repo hygiene

- **Covers:** BLD-14 (Low, R). Chore, S.
- **Problem:** The `.baseline-dist/` verification folder was untracked and not ignored, so a broad `git add` would have committed it. A comment in `vite.config.ts` contains mojibake.
- **Evidence:** `git status` listed `.baseline-dist/` as untracked, and `.gitignore` does not cover it. The folder has since been deleted (checked 2026-10-20, before the docs commit). `vite.config.ts:17` reads "modifyâ€”" (a double-encoded em dash).
- **Change:**
  - Done: `.baseline-dist/` is deleted. R9 (ea8091e) now fails `npm run check` if such a folder is ever committed at the root.
  - The comment sits inside the `DISABLE_HMR` block, which AGENTS.md says not to touch. Fix it only with the owner's agreement, as a separate comment-only change.
- **Accept when:** `git status` is clean after a build and verification run.
- **Order:** now.

### P3.11 Design generator polish

- **Covers:** DES-14 (Low, C), DES-15 (Low, C), DES-16 (Low, C), DES-18 (Low, C). Logic, M.
- **Problem:**
  - CCD is always face-centred with a full 2^k cube, and BBD for k ≥ 6 is not the published design.
  - The planner overwrites a run count the user chose.
  - Run-pattern labels match levels differently from the engine.
  - Design-type enums and names are duplicated in six places.
- **Evidence:**
  - CCD and BBD: `src/core/design/doeGenerator.ts:126-157`, `:188-220` (α = 1, full cube), `:245-258` (all factor pairs: k = 6 gives 60 runs; the published design has 48).
  - Planner: `src/web/features/design/ProjectDesign.tsx:447-449`.
  - Patterns: `src/core/design/doePatterns.ts:20` (case-sensitive `indexOf`, versus `analysisCore.ts:62-63`), `:40-47` (a ±15% band counts as centre).
  - Duplicates: `src/server/mcp/doeMcpServer.ts:243`, `:342`, `:448`; `src/web/pages/ProjectView.tsx:56-63`; `src/web/features/export/htmlExport.ts:32-39`; `src/core/types.ts:2`.
- **Change:**
  - An α choice and fractional cubes for CCD; BIBD-based BBD tables for k ≥ 6.
  - Reset the run count only when the user has not edited it.
  - Use the shared level matcher (P2.8).
  - `src/core/design/designTypes.ts` holds `DESIGN_TYPES` and display keys, and the zod enums derive from it.
- **Accept when:**
  - The CCD α option sets the correct axial distance.
  - A BBD with k = 6 has the published run count.
  - A user-edited run count survives factor edits.
  - The pattern column agrees with the engine's coding.
  - A new design type needs one core edit plus translations.
- **Order:** after P2.3.

### P3.12 MCP server hygiene

- **Covers:** MCP-23 (Low, C). Logic, S.
- **Problem:**
  - Every MCP write broadcasts the whole database twice.
  - The context has unused members.
  - Tools use deprecated SDK overloads, without output schemas.
  - The server name and version are hard-coded in four places.
- **Evidence:** `server.ts:225-242` (`saveProject` already emits); `src/server/mcp/doeMcpServer.ts:292-293`, `:357-358`, `:406-407` (a second emit through `broadcastSync`), `:8-15` (`getFolders` and `saveData` are unused by tools), `:47-51`, `:1344-1345`; `server.ts:338-341`.
- **Change:**
  - `saveProject` and `deleteProject` become the only notifiers.
  - Migrate to `registerTool`, `registerResource` and `registerPrompt`, with `outputSchema` and `structuredContent`.
  - One constant for the name and version. P3.7 later makes `package.json` the source of that version.
- **Accept when:**
  - Exactly one sync event goes out per MCP write.
  - Tools return `structuredContent` that is validated against their output schema.
- **Order:** after P1.15 and P2.12.

### P3.13 SOP steps on the server

- **Covers:** DATA-19 (Low, C). Logic, S.
- **Problem:** User-edited SOP steps live only in one browser's localStorage. They are not shared, not backed up, and lost when browser data is cleared.
- **Evidence:** `src/web/pages/GuideView.tsx:21` (the key), `:82` (read), `:106` (write).
- **Change:** store the steps on the server, with schema and version handling, and keep the JSON import and export.
- **Accept when:**
  - Steps edited in one browser appear in another.
  - They survive clearing browser data.
  - Existing local steps are migrated once.
- **Order:** after P2.16 and P2.14.

## Unregistered findings (awaiting IDs)

These were found while writing the doc set and checked against the current code. They have no IDs yet. When the lead registers them, add the new IDs to the named item and to the index.

Registered on 2026-10-20 with the docs commit: UI-31 (HTML report "Model p-value", including `optimalConditions.pModel`), STAT-27, DES-19, DES-20, DES-21, UI-32, UI-33, DATA-21, DATA-22, DATA-23 and SRV-13.

Registered on 2026-10-21: SRV-14 (the HMR `clientPort` ignores `PORT`), found while checking cc41f15, in P3.9.

None are open.

Resolved without an ID:

| Finding | Resolution |
|---|---|
| `addEmptyRun` uses `runOrder = runs.length + 1` (`src/web/features/design/ProjectDesign.tsx:1079`) | Same defect as DATA-20; added to DATA-20's evidence in P2.11 |
| `npm run check` did not look at the repo root (R1 covers only `src/`) | Done in ea8091e: rule R9 in `scripts/check-boundaries.mjs` (now `:16-20`, `:74-84`) fails when git tracks a root entry outside the agreed list ([design spec §3.2](design-spec.md#32-layer-rules-enforced-by-npm-run-check), [patch scripts lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)) |
| Both lockfiles deleted on `main`: cc41f15 ("build: configure server port and HMR settings", M-Alekseychuk, 2026-10-21, an AI Studio push 13 minutes after PR #1 merged) deletes `package-lock.json`, `bun.lock` and `assets/.aistudio/.gitignore`, and its message mentions none of them. `npm ci` fails without a lockfile | Decision 1 settled on 2026-10-21 (PR #4): no lockfile for now. `.gitignore` lists both files, CI will use `npm install` (P2.1 step 2), and BLD-7 in P2.2 keeps the rest (`packageManager`, `engines`). Restoring `assets/.aistudio/.gitignore` is the owner's call. The same commit's `PORT` and `DISABLE_HMR` changes are recorded under SRV-8, SRV-10 and the new SRV-14 (P3.9) |

## ID index

Severity: C = Critical, H = High, M = Medium, L = Low. Basis: R = confirmed by running, C = confirmed by reading, P = plausible, unverified.

161 IDs. Some pairs describe one defect from two angles (for example SRV-3 = BLD-1), so there are fewer distinct defects than IDs.

| Prefix | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| STAT | 4 | 8 | 7 | 8 | 27 |
| DES | 3 | 5 | 7 | 6 | 21 |
| MCP | 2 | 9 | 10 | 2 | 23 |
| SRV | 0 | 3 | 4 | 7 | 14 |
| DATA | 1 | 8 | 10 | 4 | 23 |
| UI | 4 | 11 | 14 | 4 | 33 |
| I18N | 0 | 0 | 4 | 2 | 6 |
| BLD | 0 | 3 | 7 | 4 | 14 |
| **All** | **14** | **47** | **63** | **37** | **161** |

| ID | Sev | Basis | Issue | Item |
|---|---|---|---|---|
| STAT-1 | C | R | Wrong (X'X)⁻¹ for rank-deficient models | P0.3 |
| STAT-2 | C | R | Lenth pseudo-error scaled wrongly | P0.4 |
| STAT-3 | C | C | No quadratic terms in the analysis model | P0.9 |
| STAT-4 | C | R | Optimum search truncates its grid | P0.8 |
| STAT-5 | H | R | Saturated models show SE 0, p 1, zero-width intervals | P0.4 |
| STAT-6 | H | C | Three desirability formulas | P2.5 |
| STAT-7 | H | C | Profiler ignores saved excluded terms | P0.6 |
| STAT-8 | H | C | HTML export surfaces from a main-effects model | P0.10 |
| STAT-9 | H | C | Monte Carlo understates spread, implemented twice | P2.6 |
| STAT-10 | H | C | Optimizer target 0 becomes 70 | P1.21 |
| STAT-11 | H | C | Missing or unparseable factor values coded as settings | P1.11 |
| STAT-12 | H | C | MCP `run_analysis` wrong statistics and crashes | P0.5 |
| STAT-13 | M | C | Ad-hoc GP surrogate, overconfident extrapolation | P2.7 |
| STAT-14 | M | C | Coded values clamped to [−2, 2] | P1.11 |
| STAT-15 | M | C | Categorical effect magnitudes not model-based | P2.9 |
| STAT-16 | M | C | Effect-plot data forked three ways | P2.8 |
| STAT-17 | M | C | Excel Effect Tests hard-code Nparm and DF | P1.22 |
| STAT-18 | M | C | Diagnostics label runs by position | P2.11 |
| STAT-19 | M | C | Optimal settings rounded to 2 decimals | P2.7 |
| STAT-20 | L | C | √F of multi-df terms compared with a 1-df t limit | P2.9 |
| STAT-21 | L | R | Box-Cox recommends 1/Y on a perfect fit | P0.4 |
| STAT-22 | L | C | No model p-value, PRESS or predicted R² | P3.5 |
| STAT-23 | L | C | Key Drivers sorts by a missing field, matches by prefix | P2.10 |
| STAT-24 | L | C | Fallback predictor wrong for 3+ levels | P3.4 |
| STAT-25 | L | C | Dead and duplicated statistics code | P3.4 |
| STAT-26 | L | P | Non-numeric responses pass the filter | P1.11 |
| STAT-27 | L | C | 1-level categorical: column `name[undefined]`, constant contrast | P1.10 |
| DES-1 | C | C | Generate overwrites measured runs without asking | P0.2 |
| DES-2 | C | R | Fractional factorial is a D-optimal subset | P0.11 |
| DES-3 | C | R | DSD main effects correlated | P0.12 |
| DES-4 | H | R | D-optimal model has no quadratic terms | P0.9 |
| DES-5 | H | R | D-efficiency misreported | P1.18 |
| DES-6 | H | C | Centre-point setting ignored or overridden | P1.20 |
| DES-7 | H | C | No valid, reproducible randomisation | P1.19 |
| DES-8 | H | C | UI design generator forked from core | P2.3 |
| DES-9 | M | R | Weak, deterministic exchange, mislabelled | P2.4 |
| DES-10 | M | C | Resolution table has wrong entries | P0.11 |
| DES-11 | M | R | D-optimal freezes the browser for 9+ factors | P2.4 |
| DES-12 | M | C | PB holds factors 20+ constant | P2.4 |
| DES-13 | M | C | Comma-to-dot replacement corrupts numbers | P1.12 |
| DES-14 | L | C | CCD always face-centred; BBD k ≥ 6 not published | P3.11 |
| DES-15 | L | C | Planner overwrites the chosen run count | P3.11 |
| DES-16 | L | C | Pattern labels match differently from the engine | P3.11 |
| DES-17 | L | C | Resolution table: unreachable entries, no legend, no source | P0.11 |
| DES-18 | L | C | Design-type enum and names duplicated | P3.11 |
| DES-19 | M | C | UI adds centre runs to all-categorical factorial and custom D-optimal designs | P1.20 |
| DES-20 | L | C | Augmentation writes `undefined` for a categorical with `levels: []` | P1.20 |
| DES-21 | M | C | Core adds no centre points to custom D-optimal or subset fractions | P1.20 |
| MCP-1 | C | R | Model DF reported as the model p-value | P0.5 |
| MCP-2 | C | R | Robustness clamp wrong for zero and negative ranges | P0.7 |
| MCP-3 | H | C | Three desirability functions disagree | P2.5 |
| MCP-4 | H | R | Substring lookup; an empty id deletes the first project | P1.14 |
| MCP-5 | H | R | Direct `tools/call` skips zod validation and defaults | P1.15 |
| MCP-6 | H | R | Pareto ranking reads missing fields | P0.5 |
| MCP-7 | H | R | `excludedTerms` by name silently ignored | P0.5 |
| MCP-8 | H | C | Untestable lack of fit reported as adequate | P0.5 |
| MCP-9 | H | R | `run_analysis` crashes on saturated 3+ level designs | P0.5 |
| MCP-10 | H | R | `generate_doe_design` replaces results; a stored `centerPoints: 0` becomes 3 when the call omits it | P0.2 |
| MCP-11 | H | R | Optimizer grid drops factors and blocks the event loop | P2.5 |
| MCP-12 | M | C | Optimum saved without a model; weight 0 → 1; overwrites the report | P1.16 |
| MCP-13 | M | R | D-efficiency multiplied by 100 twice | P1.18 |
| MCP-14 | M | C | `add_run_results` stores junk keys, matches ambiguously | P1.16 |
| MCP-15 | M | C | `predict_response` ignores unknown keys, no interval | P1.16 |
| MCP-16 | M | R | Monte Carlo duplicated; "Cpk" is Ppk | P2.6 |
| MCP-17 | M | R | Non-conformant hand-written dispatcher on private SDK fields | P1.15 |
| MCP-18 | M | R | Shown stdio config does not work | P1.17 |
| MCP-19 | M | C | MCP and UI design generation are forks | P2.3 |
| MCP-20 | M | C | stdio copies the store bootstrap, drifted | P2.12 |
| MCP-21 | M | C | In-memory "audit log" | P2.18 |
| MCP-22 | L | C | Deprecated SSE only; no Streamable HTTP | P1.15 |
| MCP-23 | L | C | Double broadcast, unused context, deprecated overloads | P3.12 |
| SRV-1 | H | C | No auth, open CORS, listens on 0.0.0.0 | P1.1 |
| SRV-2 | H | C | Production serves `server.cjs.map` | P1.2 |
| SRV-3 | H | C | `npm start` runs dev middleware (same defect as BLD-1) | P1.2 |
| SRV-4 | M | C | Secure-context APIs break over LAN HTTP | P2.21 |
| SRV-5 | M | C | `server.ts` untyped monolith | P2.12 |
| SRV-6 | M | R | CJS bundle requires ESM-only `uuid`; no engines (same defect as BLD-13) | P2.2 |
| SRV-7 | L | C | SPA fallback for unknown API GETs; error echo | P3.9 |
| SRV-8 | L | C | cwd-relative paths; `.env` not loaded (the hard-coded port was fixed in cc41f15) | P3.9 |
| SRV-9 | L | C | Whole-DB write and broadcast per edit | P1.7 |
| SRV-10 | L | R | `DISABLE_HMR` still leaves a Vite socket on port 24678 (the inline `hmr` override was fixed in cc41f15) | P3.9 |
| SRV-11 | L | C | Unused deps, Gemini leftovers, template identity, versions | P3.6 |
| SRV-12 | L | C | Root-absolute paths versus `base: './'` | P2.14 |
| SRV-13 | M | R | A `data.json` holding `null` crashes startup | P1.5 |
| SRV-14 | L | R | HMR `clientPort` stays 3000 when `PORT` is set | P3.9 |
| DATA-1 | C | C | Demo buttons wipe all data (fixed 2026-10-21) | P0.1 |
| DATA-2 | H | C | Non-atomic writes; corrupt file reseeded | P1.5 |
| DATA-3 | H | C | Server and stdio both own `data.json` | P1.6 |
| DATA-4 | H | C | Whole-project last-writer-wins | P1.7 |
| DATA-5 | H | C | Save failures invisible, edits discarded | P1.8 |
| DATA-6 | H | C | Excel import invents or drops values | P1.12 |
| DATA-7 | H | R | Any payload stored; one bad project breaks MCP and UI | P1.10 |
| DATA-8 | H | P | Double save channel and echo can revert edits | P1.7 |
| DATA-9 | H | P | Cloud Run filesystem is temporary | P1.9 |
| DATA-10 | M | C | JSON import barely validates | P1.10 |
| DATA-11 | M | C | Edits do not cascade | P2.17 |
| DATA-12 | M | C | No schema version; purge copied three times | P2.16 |
| DATA-13 | M | C | Deleted demo returns; empty server refilled from cache | P2.15 |
| DATA-14 | M | R | Sample constants mutated in place | P2.15 |
| DATA-15 | M | C | Robustness tab writes the project on open | P2.6 |
| DATA-16 | M | C | No change history, identity or backups | P2.18 |
| DATA-17 | M | C | Permanent and folder deletes on one click | P1.13 |
| DATA-18 | L | C | Fragile browser cache | P2.14 |
| DATA-19 | L | C | SOP steps only in localStorage | P3.13 |
| DATA-20 | L | C | Ids and run order generated inconsistently | P2.11 |
| DATA-21 | M | C | Live sync gives up after 3 reconnects; the stale tab keeps overwriting | P1.8 |
| DATA-22 | L | C | Categorical `min`/`max` has no single convention | P1.10 |
| DATA-23 | M | C | Names not unique, but some paths key by name | P1.10 |
| UI-1 | C | C | Demo buttons wipe all data (fixed 2026-10-21) | P0.1 |
| UI-2 | C | C | Generate, import and Simulate overwrite measurements | P0.2 |
| UI-3 | C | C | Profiler uses full models for non-active responses | P0.6 |
| UI-4 | C | C | HTML export surfaces drop interactions and categoricals | P0.10 |
| UI-5 | H | C | Three desirability formulas | P2.5 |
| UI-6 | H | C | Interaction means computed three ways | P2.8 |
| UI-7 | H | C | Main-effects plot double-counts numeric-like levels | P2.8 |
| UI-8 | H | R | Excel export fails silently on common names | P1.22 |
| UI-9 | H | C | Robustness uses 0 for new factors; tab writes on open | P2.6 |
| UI-10 | H | C | Optimizer target 0 becomes 70 | P1.21 |
| UI-11 | H | C | HTML export not escaped (stored XSS) | P1.4 |
| UI-12 | H | C | Excel run import accepts invalid values | P1.12 |
| UI-13 | H | C | Residual PNG download hits the first response | P1.23 |
| UI-14 | H | P | Selector promises a resolution the subset lacks | P0.11 |
| UI-15 | M | C | Design generator duplicated in the UI | P2.3 |
| UI-16 | M | C | Bayesian optimizer inside the component | P2.7 |
| UI-17 | M | C | Diagnostics rule engine in the component | P2.10 |
| UI-18 | M | C | Surface grid code ×3; categoricals at an index midpoint | P2.8 |
| UI-19 | M | C | Duplicated widgets in Analysis and Compare | P2.19 |
| UI-20 | M | C | Other destructive actions unconfirmed; playground mutates demo | P1.13 |
| UI-21 | M | C | Report needs CDNs; different Plotly | P3.8 |
| UI-22 | M | C | Secure-context APIs over LAN HTTP | P2.21 |
| UI-23 | M | C | No app-level error boundary | P1.10 |
| UI-24 | M | C | DOE Mean plot labels by position | P2.11 |
| UI-25 | M | P | Tab state not in the URL; no `key` | P2.20 |
| UI-26 | M | R | Guide launch ignores the target tab | P2.20 |
| UI-27 | M | C | Setup accepts invalid ranges, mangles targets | P2.17 |
| UI-28 | L | R | Dead code in `src/web` | P3.3 |
| UI-29 | L | C | Stale memo dependency, duplicate fit | P3.3 |
| UI-30 | L | C | Gemini-era LaTeX clean-up | P2.7 |
| UI-31 | H | C | HTML report shows the model DF as "Model p-value" (same root cause as MCP-1) | P0.5 |
| UI-32 | M | C | Analysis refits every response on every render | P3.3 |
| UI-33 | L | C | Dead `location.pathname` comparison in the sidebar | P3.3 |
| I18N-1 | M | R | ~600 inline bilingual branches | P3.1 |
| I18N-2 | M | R | Exports English-only | P3.2 |
| I18N-3 | M | C | Parallel translation tables | P3.2 |
| I18N-4 | M | C | English-only strings outside the ternaries | P3.1 |
| I18N-5 | L | R | 133 of 187 keys unused | P3.1 |
| I18N-6 | L | C | Locale plumbing loose ends | P3.1 |
| BLD-1 | H | C | `npm start` runs in development mode (same defect as SRV-3) | P1.2 |
| BLD-2 | H | C | Bundle and source map served from `dist/` | P1.2 |
| BLD-3 | H | R | Vulnerable dependencies; `xlsx` parses uploads | P1.3 |
| BLD-4 | M | C | No tests, no CI | P2.1 |
| BLD-5 | M | C | Unused and redundant dependencies | P3.6 |
| BLD-6 | M | R | 2 MB main chunk plus 4.9 MB blocking Plotly | P3.8 |
| BLD-7 | M | C | No package manager or engine declared; lockfiles drifted, then cc41f15 deleted both (decision 1: none for now) | P2.2 |
| BLD-8 | M | R | Version hard-coded in 10 places (7 files) | P3.7 |
| BLD-9 | M | R | Not strict; no linter | P2.13 |
| BLD-10 | L | C | Gemini leftovers in metadata and env | P3.6 |
| BLD-11 | L | C | Template and branding leftovers | P3.6 |
| BLD-12 | L | C | Unused `@` alias contradicts R2 | P3.9 |
| BLD-13 | M | R | Relies on `require(esm)`; no Node version (same defect as SRV-6) | P2.2 |
| BLD-14 | L | R | Mojibake comment; untracked `.baseline-dist/` | P3.10 |
