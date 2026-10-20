# DOE-Magic — Design Spec

> Created: 2026-10-20. Status: normative architecture contract. Sections 2, 3.1 and 4–7 describe the code as it is (verified on branch `chore/project-structure-and-core-docs`, commit 534ec68). Known defects are flagged by issue ID here and fixed in later PRs.
> Related: [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Goals](../../task/DOE-Magic/goals.md), [Roadmap and backlog](roadmap-backlog.md), [Server and persistence](../../context/DOE-Magic/server-and-persistence.md), [MCP server](../../context/DOE-Magic/mcp-server.md), [Web UI](../../context/DOE-Magic/web-ui.md), [Statistics engine](../../context/DOE-Magic/statistics-engine.md), [Design generation](../../context/DOE-Magic/design-generation.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [AGENTS.md](../../../AGENTS.md)

## 1. Purpose and scope

This document is the contract that every change to DOE Magic must follow, whether a person or an AI agent makes it. It defines:

- the runtimes and their entry points (§2);
- the source layers, the rules R1–R9 that `npm run check` enforces, and where new code goes (§3);
- the persisted data model and its implicit conventions (§4);
- the persistence and sync protocol (§5) and the external interfaces (§6);
- build, run and deploy, including the Google AI Studio constraints that must not be broken (§7);
- the i18n contract (§8) and the change process (§9).

Terms:

- **MUST, MUST NOT, SHOULD** have their RFC 2119 meanings. They are the contract.
- **As-is** marks a description of current behaviour. It is not a promise to keep that behaviour. Defects carry an ID from the [issue registry](roadmap-backlog.md) (`STAT-n`, `DES-n`, `MCP-n`, `SRV-n`, `DATA-n`, `UI-n`, `I18N-n`, `BLD-n`). Changing as-is behaviour follows §9.
- **Contract surface** means anything that other code, stored data or external clients depend on: the data model (§4), storage keys and file formats (§5, §6), REST and socket.io messages (§5, §6), MCP tool names, inputs and outputs (§6), statistical semantics (model terms, term IDs, p-values, effect scales, desirability), and the layer rules (§3).

The subsystem internals are described in the context docs. This spec covers only what a change must respect.

## 2. Runtimes and entry points

DOE Magic runs as three kinds of process. The statistics and design engine (`src/core`) is loaded by all three.

| Runtime | Entry | Started by | Loads |
|---|---|---|---|
| Browser | `index.html:36` `<script type="module" src="/src/main.tsx">` → `src/main.tsx` → `src/web/App.tsx` and `src/web/index.css` | Served by process A: Vite middleware in development, `dist/` in production | `src/web/**`, `src/core/**`. Plotly is a global (`window.Plotly`) loaded from `public/plotly.min.js` by `index.html:8`. |
| Node, process A | `server.ts` | `npm run dev` (`tsx server.ts`) or `npm start` (`node dist/server.cjs`) | `src/core/sampleProject.ts`, `src/server/mcp/doeMcpServer.ts` → `src/core/**` |
| Node, process B | `src/server/mcp/stdio.ts` | `npm run mcp` (`tsx src/server/mcp/stdio.ts`), launched by a desktop AI client | `src/server/mcp/doeMcpServer.ts`, `src/core/**` |

```text
 BROWSER (one per open tab)
   index.html --module--> src/main.tsx --> src/web/App.tsx   (HashRouter: #/, #/project/:id, #/guide)
   src/web/** --import--> src/core/**                        (analysis and design run in the browser)
   index.html <script src="/plotly.min.js"> --> window.Plotly
        |  HTTP: /api/* (data), /api/mcp, /api/mcp/info, /api/mcp/logs (MCP panel)
        |  socket.io: update_project, delete_project, update_folder, delete_folder (client -> server)
        |             sync_data (server -> client, whole database)
        v
 NODE PROCESS A: server.ts   Express on 0.0.0.0:3000
   +-- REST /api/* and socket.io handlers ----------------------+
   +-- MCP over HTTP: SSE /mcp/sse, /api/mcp/sse                 |--> in-memory db {projects, folders}
   |                  POST /mcp/messages, /api/mcp/messages      |    read once at start,
   |                  direct JSON-RPC POST /mcp, /api/mcp        |    whole file rewritten
   |     --> src/server/mcp/doeMcpServer.ts --> src/core/** -----+    after every write
   +-- dev:  Vite middleware (index.html, src/**, HMR)                     |
       prod: express.static(<cwd>/dist) + index.html fallback              v
                                                                    <cwd>/data.json
 NODE PROCESS B: npm run mcp  (AI client talks JSON-RPC over stdin/stdout)    ^
   src/server/mcp/stdio.ts --> doeMcpServer.ts --> src/core/**                |
   own in-memory db copy, read once at start, file rewritten after each write -+
   (no link to process A: no broadcast, and the last writer wins on the file, DATA-3)

 Remote AI client --> process A over SSE (/mcp/sse) or one-shot JSON-RPC (/api/mcp)
```

Rules:

- The three entry files (`index.html`'s module script target, the file `npm run mcp` runs, and `server.ts`) MUST exist at these paths (R8, §3). AI Studio also expects `server.ts`, `index.html` and `src/main.tsx` where they are (§7.4).
- Process A is the only process that serves the browser. There is no build step between the browser and `src/` in development: Vite transforms `src/**` on request.
- Process B is optional. Running it at the same time as process A is unsafe as-is (DATA-3).

## 3. Layers and rules

### 3.1 Layout

```text
src/main.tsx           Vite entry (AI Studio template location; do not move)
src/vite-env.d.ts      Vite client types
src/core/              PURE TypeScript, loaded by browser and Node
  types.ts             persisted data model (§4)
  sampleProject.ts     demo project and folder used for seeding
  analysis/            analysisCore.ts: OLS, ANOVA, effects, Box-Cox, desirability, prediction
  design/              doeGenerator.ts, dOptimal.ts, doePatterns.ts, designMatrixData.ts
src/server/            NODE ONLY, loaded by server.ts and npm run mcp
  mcp/                 doeMcpServer.ts (tools, resources, prompts), stdio.ts (stdio entry)
src/web/               BROWSER ONLY
  App.tsx, Layout.tsx, index.css, assets/
  state/               ProjectContext.tsx (client store and server sync)
  i18n/                LanguageContext.tsx, LanguageSelector.tsx, translations.ts
  shared/              UI used by more than one feature
  pages/               Dashboard.tsx, GuideView.tsx, ProjectView.tsx
  features/<tab>/      setup, design, analysis, compare, optimization, robustness, export, mcp-panel
```

The Express server itself is still the root `server.ts`. Splitting it into `src/server/{store,routes,realtime,mcp/http}` is backlog (SRV-5, MCP-20).

Dependency direction:

```text
src/main.tsx --> src/web --> src/core
server.ts, src/server/mcp/stdio.ts --> src/server --> src/core
src/core --> src/core only (+ npm: jstat, uuid)
```

Inside `src/web` the observed directions are below. The checker enforces only R5 and R6, but new code SHOULD keep to them:

- `App.tsx` → `Layout`, `pages/`, `state/`, `i18n/`.
- `Layout.tsx` → `state/`, `i18n/`, `assets/` (the logo), and `features/mcp-panel/` (the sidebar modal).
- `pages/` → `features/`, `state/`, `i18n/`, `core`.
- `features/<x>/` → its own folder, `shared/`, `i18n/`, `core`. Features do not import `state/`. The tab components receive `project` and a save callback as props from `pages/ProjectView.tsx:485-490` (`updateProject`; `onUpdateProject` for Analysis; Compare gets only `project`).
- `shared/` → `i18n/`.
- `state/` → `core`.

### 3.2 Layer rules (enforced by `npm run check`)

`npm run check` runs `tsc --noEmit` and then [`scripts/check-boundaries.mjs`](../../../scripts/check-boundaries.mjs). Both MUST pass before a change is finished. The rules, verbatim:

- **R1** `src/` top level contains only `main.tsx`, `vite-env.d.ts`, `core/`, `server/`, `web/`. Dotfiles such as `.DS_Store` are ignored.
- **R2** Imports between project files are relative; specifiers starting with `"@/"` or `"src/"` are rejected; every relative import must resolve to a file. The reason: `"@/"` maps to the repo root (the alias in `vite.config.ts` and `paths` in `tsconfig.json`), not to `src/`, and the check cannot place an aliased import in a layer. (Vite, esbuild and tsx do resolve `"@/"`; the rule is about clarity and checkability, not about a broken alias.)
- **R3** `src/core/**` is plain TypeScript: no `.tsx` or `.jsx`; may import only `src/core/**` and the npm packages `jstat` and `uuid`; never reads the browser globals `window`, `document`, `localStorage`, `sessionStorage` or `navigator`.
- **R4** Server code (`src/server/**` and `server.ts`) imports project files only from `src/core/**` and `src/server/**`. npm packages are allowed, except React.
- **R5** Browser code (`src/web/**` and `src/main.tsx`) never imports `src/server/**` (the browser talks to the server over HTTP/socket.io only).
- **R6** `src/web/features/<a>/**` never imports `src/web/features/<b>/**`, and no loose files sit directly in `src/web/features/`; code used by two features goes to `src/web/shared/` (UI) or `src/core/` (logic).
- **R7** Everything reachable through relative imports from `server.ts` and `src/server/mcp/stdio.ts` (the stdio MCP entry) lies in `src/core/` or `src/server/`.
- **R8** Entry points exist: `index.html`'s module script (`/src/main.tsx`), the file `npm run mcp` runs, and `server.ts`.
- **R9** Git tracks only these entries at the repo root: `.env.example`, `.github/`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `README.md`, `assets/`, `bun.lock`, `docs/`, `index.html`, `metadata.json`, `package-lock.json`, `package.json`, `public/`, `scripts/`, `server.ts`, `src/`, `tsconfig.json`, `vite.config.ts`. A tracked `.aistudio/` or `data.json` fails with its own message: "re-added by an AI Studio sync; remove it from git with `git rm -r --cached` (it is in .gitignore)". Adding an entry means updating the list in `scripts/check-boundaries.mjs` and `AGENTS.md`. Skipped with a warning ("not a git checkout (or git is not installed)") when `git ls-files` cannot run.

The rule text is normative. The checker is a heuristic minimum, so passing it does not prove compliance.

How the checker works. It uses the TypeScript compiler API, so it imports `typescript` (a devDependency) and needs `node_modules`; `npm run check` is run after `npm install`. Imports are read with `ts.preProcessFile` (`scripts/check-boundaries.mjs:35`), which returns static imports, re-exports, side-effect imports, `import()` and `require()` with string-literal arguments; commented-out code and strings that merely look like imports do not count. Browser globals are found on the syntax tree (`:37-53`): a property or element access whose object is one of the five global names (`window.x`, `localStorage?.getItem`, `document['x']`), so words in comments and strings never match. Each scanned file is placed in a layer by its path (`:62`): `src/main.tsx` counts as `web`, `server.ts` as `server`, everything else by its `src/<layer>/` folder.

| Rule | How `check-boundaries.mjs` checks it | Not caught |
|---|---|---|
| R1 | Lists `src/` entries, skipping names that start with `.` (`:15`, `:69-72`) | — |
| R2 | Rejects `@/` and `src/` specifiers (`:105-109`). Resolves relative specifiers after stripping any `?query` or `#hash`, also trying `./x.js` as `x.ts` (and `.jsx` as `.tsx`, `.mjs` as `.mts`), with suffixes `''`, `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `/index.ts`, `/index.tsx`; an unresolved specifier fails (`:22`, `:55-60`, `:116-117`) | Specifiers computed at run time |
| R3 | `.tsx` or `.jsx` under `src/core` fails. Package imports other than `jstat` and `uuid` fail. Relative imports must land in `core`. The first browser-global access per file is reported with its line (`:14`, `:21`, `:98-102`, `:110-112`, `:121`) | `typeof window` or a bare `window` passed as a value, globals reached through `globalThis` or other aliases, files under `src/core` with an extension other than `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` (not scanned), `Math.random`/`Date.now` (allowed but see §3.4) |
| R4 | Relative imports from `src/server` or `server.ts` must land in `core` or `server`. Bare packages whose name starts with `react` fail (`:113`, `:122`) | Other browser-only packages imported by bare name; CSS or image files placed inside `src/server` itself |
| R5, R6 | Layer and feature folder of the resolved target (`:123-127`). A file directly in `src/web/features/` fails R6 (`:95-97`) | — |
| R7 | Breadth-first walk from `server.ts` and the `npm run mcp` target (`:139-150`) | Dynamic imports with computed paths |
| R8 | Reads the `index.html` module script and the first `.ts` token of `scripts.mcp` (`:131-137`) | — |
| R9 | Runs `git ls-files` and checks the first path segment of every tracked file against `REPO_TOP_LEVEL`; `.aistudio` and `data.json` get the AI Studio message (`:16-20`, `:74-84`). If git cannot run, it prints a warning and skips the rule | Untracked files until they are committed; stray files inside an allowed folder such as `scripts/` or `docs/`; any run outside a git checkout |

Scope: R2–R8 scan `src/**/*.{ts,tsx,js,jsx,mjs,cjs}` and `server.ts` (`:67`, `:86`); R1 lists `src/`, and R9 lists the files git tracks. `tsc` covers `src`, `server.ts` and `vite.config.ts` (`tsconfig.json` `include`). Adding an npm package to `src/core` MUST update R3 in this spec, `AGENTS.md` and `CORE_PACKAGES` (`scripts/check-boundaries.mjs:14`) in the same PR. One example is zod for shared schemas (DATA-7).

The checker has a self-test, `node scripts/check-boundaries.test.mjs` (commit 534ec68). Run it after changing the checker. Its 28 cases are 21 injected violations covering R1–R9 that must fail with the right rule, and 7 former false positives (for example commented-out imports, import-like strings and `localStorage` in a comment) that must pass. On the clean tree `npm run check` prints `Layer boundaries OK: 35 files, 8 reachable from the Node entry points.`

Consequence for tests (BLD-4): a test file under `src/core/` that imports a test runner (for example `vitest`) fails R3 today. The PR that adds tests MUST either put them outside `src/` (for example `tests/`, mirroring `src/`) or teach the checker to skip `*.test.ts`, and record that choice here.

### 3.3 Where does new code go?

| You are adding | Put it in | Also |
|---|---|---|
| A statistic, model term, test, effect or diagnostic rule | `src/core/analysis/` | The UI and MCP both call it. Never only in a component or only in MCP. |
| A design type or design-generation step (randomisation, run planner, augmentation) | `src/core/design/` | Add the type to `DesignType` (`src/core/types.ts:2`), and today also to the MCP zod enums (`src/server/mcp/doeMcpServer.ts:243, 342, 448`) and the display-name maps (DES-18) |
| Desirability or optimisation logic | `src/core/optimization/` (new folder) | One implementation for Analysis, Profiler and MCP (STAT-6, MCP-3) |
| Monte Carlo robustness | `src/core/robustness/` (new folder) | One implementation for the UI and MCP (STAT-9, MCP-16) |
| A persisted field or type | `src/core/types.ts` | Update §4 first, and keep old data readable (§5.5) |
| A new tab on the project page | `src/web/features/<tab>/`, registered in `src/web/pages/ProjectView.tsx` | Takes `project` and `updateProject` props |
| A new page or route | `src/web/pages/` and a `<Route>` in `src/web/App.tsx` | |
| UI used by two or more features | `src/web/shared/` | |
| Client state or server sync | `src/web/state/` | |
| User-visible text | `src/web/i18n/translations.ts` (`en` and `zh`) | §8 |
| A REST route or socket.io event | `server.ts` today; `src/server/routes/` or `src/server/realtime/` after the split (SRV-5) | Update §5 and §6 |
| An MCP tool, resource or prompt | `src/server/mcp/` (`doeMcpServer.ts` today), calling `src/core` | Update [mcp-server.md](../../context/DOE-Magic/mcp-server.md) first |
| Store code shared by `server.ts` and `stdio.ts` | `src/server/store/` (planned, MCP-20) | |
| A static file served as-is at `/` | `public/` | |
| An image or stylesheet imported by UI code | `src/web/assets/` | |
| A maintained tool script | `scripts/`, plus an npm script in `package.json` | |
| A one-off, patch or debug script | Not in the repo. Use a scratch directory outside it | [Lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md) |
| Documentation | `docs/{task,spec,context,memory}/DOE-Magic/` | WF header style |

Planned module map. These are target locations from the backlog. The PR that creates a module uses this name. Where registry entries disagree, the name below wins.

| Module | Replaces or absorbs | Issues |
|---|---|---|
| `src/core/analysis/{linalg,anova,modelSpec,coding,projectModels,effects,effectPlots,surfaceGrid,diagnostics}.ts` | Parts of `analysisCore.ts`, plot and diagnostics code in `ProjectAnalysis.tsx`, `CompareResponses.tsx`, `htmlExport.ts`; per-response model fitting repeated by every caller | STAT-1/2/3/7/8/11/15/16/20/23, UI-3/4/6/7/17/18 |
| `src/core/optimization/{desirability,optimize,bayesOpt}.ts` | Desirability in `analysisCore.ts`, `PredictionProfiler.tsx`, `doeMcpServer.ts`; optimiser in `ProjectOptimization.tsx` | STAT-4/6/13, MCP-3/11, UI-5/16. MCP-3/MCP-11 name `src/core/analysis/desirability.ts` and UI-16 names `bayesian.ts`; use the names here |
| `src/core/robustness/monteCarlo.ts` | Loops in `RobustnessSimulation.tsx` and `simulate_robustness` | STAT-9, MCP-2/16, UI-9. MCP-2/MCP-16 name `src/core/analysis/robustness.ts`; use the name here |
| `src/core/design/{fractions,dsd,randomize,designTypes,planner,augment}.ts` | `generateRuns` in `ProjectDesign.tsx` (DES-8) | DES-2/3/7/18, UI-15 |
| `src/core/{schema,migrations,projectOps,ids,version}.ts`, `src/core/io/{runMatrixImport,parseNumber,projectJson}.ts` | Validation, migration, number parsing and ID code spread over server, stdio and web | DATA-6/7/10/11/12/20, DES-13, SRV-11 |
| `src/server/store/{jsonFileStore,changeLog}.ts`, `src/server/routes/`, `src/server/realtime/`, `src/server/http/security.ts`, `src/server/mcp/{http,lookup,activityLog}.ts` | `server.ts` bodies, `stdio.ts` bootstrap, `handleDirectJsonRpc` | SRV-1/5, MCP-4/5/17/20/21/22, DATA-2/3/16 |
| `src/web/shared/{ConfirmDialog,AppErrorBoundary,HelpTooltip}.tsx`, `src/web/shared/{downloadPng,plotly}.ts` | Duplicated widgets in Analysis and Compare | UI-1/2/13/19/20/23, DATA-17 |
| `src/web/state/{api,localCache}.ts`, `src/web/features/export/excelExport.ts` | HTTP, socket and cache code in `ProjectContext.tsx`; the Excel export in `ProjectView.tsx` | DATA-5/18, SRV-12, UI-8, STAT-17 |

### 3.4 Conventions per layer

- `src/core`: new exported functions MUST have explicit TypeScript parameter and result types, not `any` (STAT-12, MCP-6 show what untyped results cause). Code that needs randomness SHOULD take an injectable seeded RNG instead of calling `Math.random` (DES-7, STAT-9). Core returns data and codes, not display prose (§8).
- `src/server`: MCP handlers validate and resolve their inputs, call `src/core`, and write only through the store context (`McpDatabaseContext`, `src/server/mcp/doeMcpServer.ts:8-15`).
- `src/web`: components render and collect input. Any calculation that MCP or another feature could need goes to `src/core` first.
- IDs: new entities SHOULD use `uuid` v4 (`import { v4 } from 'uuid'`). Do not use `crypto.randomUUID`, which is missing outside secure contexts (SRV-4, UI-22).

## 4. Domain model (`src/core/types.ts`)

All project data is persisted as a store object `{ projects: Project[], folders: Folder[] }` (browser-only settings and SOP steps live in localStorage, §5.1). There is no schema version anywhere (DATA-12).

### 4.1 Types

`FactorType = 'numeric' | 'categorical'` (`:1`). `DesignType = 'factorial_2level' | 'dsd' | 'ccd' | 'bbd' | 'plackett_burman' | 'custom_d_optimal'` (`:2`).

**Folder** (`:4-8`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | uuid from the UI; the sample folder is `folder-coupling` |
| `name` | string | Display name |
| `createdAt` | number | ms since epoch. Folders have no `updatedAt` and no nesting |

**Factor** (`:10-18`)

| Field | Type | Meaning and convention |
|---|---|---|
| `id` | string | Stable key, uuid v4 from the UI (`ProjectSetup.tsx`) and MCP (`doeMcpServer.ts:252`). Sample ids are `f1`…`f4`. It is the key in `Run.factors` and part of term IDs (§4.2) |
| `name` | string | Display name. SHOULD be unique within the project (not enforced, DATA-23, §4.3). MCP tools accept a name wherever an id is expected and resolve it case-insensitively (`doeMcpServer.ts:72-78`). The engine falls back to `run.factors[name]` when the id key is missing (`analysisCore.ts:234`) |
| `type` | `FactorType` | |
| `min`, `max` | number | Numeric: the natural-unit range used for coding, with centre `(min+max)/2` and half-range `(max-min)/2`. A zero range is treated as 1 (`analysisCore.ts:82-85`). There is no `min < max` check (UI-27). Categorical: no defined meaning. The UI writes `0` and `levels.length-1` (`ProjectSetup.tsx:76-77, 115-116`); MCP `create_project` writes the zod defaults `0`/`100` unless given (`doeMcpServer.ts:229-230`) (DATA-22, §4.3) |
| `levels` | string[]? | Categorical only: level labels in order. If missing or empty, the engine assumes `['Level 1','Level 2']` (`analysisCore.ts:60`). When fewer than 2 non-empty levels are entered, the UI substitutes `['Level 1','Level 2']` (`ProjectSetup.tsx:65, 110`) |
| `unit` | string | Display only, may be `''` |

**Response** (`:20-27`)

| Field | Type | Meaning and convention |
|---|---|---|
| `id` | string | Key in `Run.responses`. Sample ids are `r1`, `r2` |
| `name` | string | Display. MCP resolves names, falling back to substring match (`doeMcpServer.ts:81-87`, MCP-4) |
| `goal` | `'maximize' \| 'minimize' \| 'target'` | Optimisation direction |
| `targetValue` | number? | For `target`: the target. The UI sets it only when goal is `target` and clears it otherwise (`ProjectSetup.tsx:153, 443`). `analysisCore` also uses it as the upper bound for `maximize` and the lower bound for `minimize` (STAT-6, UI-27) |
| `unit` | string | Display only |
| `excludedTerms` | string[]? | Term IDs (§4.2) removed from this response's model. This is the only persisted model setting. It is toggled in Analysis (`ProjectAnalysis.tsx:1627-1636`) and read by every `computeAnalysis` caller (STAT-7/UI-3: the Profiler ignores it for non-active responses) |

**Run** (`:29-35`)

| Field | Type | Meaning and convention |
|---|---|---|
| `id` | string | uuid; samples use `run-1`…`run-27` |
| `runOrder` | number | 1-based execution order. Uniqueness is not enforced (DATA-20). The UI generator randomises it with a biased sort (`ProjectDesign.tsx:987-988`). The core generator sets `runOrder = stdOrder`, so it does not randomise (`doeGenerator.ts:74-77`, DES-7) |
| `stdOrder` | number | Standard order. Several UI design paths set it to 0 (DES-7) |
| `factors` | `Record<factorId, string \| number>` | Numeric: a number in natural units. Categorical: the level label string. Matching is trimmed and case-insensitive, with a numeric level-index fallback, and an unknown label becomes level 0 (`analysisCore.ts:62-68`, STAT-11). Numeric coded values are clamped to ±2 and `NaN` codes as 0 (`analysisCore.ts:82-86`, STAT-11, STAT-14) |
| `responses` | `Record<responseId, number \| null>` | `null` means not measured. The engine also treats `undefined` and `''` as missing (`analysisCore.ts:191`). UI entry converts to number or `null` (`ProjectDesign.tsx:1088-1098`); MCP and JSON import can store other types (MCP-5, STAT-26) |

**Project** (`:37-53`)

| Field | Type | Meaning and convention |
|---|---|---|
| `id` | string | uuid; the sample is `proj-suzuki-cross-coupling`. JSON import assigns a new uuid (`Dashboard.tsx:88-93`) |
| `folderId` | string? | Reference to `Folder.id`. It is not validated, so it can dangle (DATA-10/11). Deleting a folder unsets it on that folder's projects (`server.ts:185-188`, `ProjectContext.tsx:253-259`) |
| `name` | string | Display |
| `description` | string | Required by the type, but imported files may omit it (UI-23) |
| `factors`, `responses`, `runs` | arrays | See above. Deleting a factor or response does not clean dependent keys (DATA-11) |
| `centerPoints` | number? | Requested centre runs. The Setup tab writes it (`ProjectSetup.tsx:179-182`). The UI generator applies it only to `factorial_2level` and `custom_d_optimal` (DES-6), even when every factor is categorical (DES-19); core never applies it to `custom_d_optimal` or D-optimal-subset fractions (DES-21). MCP `generate_doe_design` uses `project.centerPoints \|\| 3` when the call omits `centerPoints`, so a stored 0 becomes 3; an explicit `centerPoints: 0` in the call is honoured (MCP-10) |
| `designType` | `DesignType`? | Absent means `factorial_2level` (`ProjectDesign.tsx:456`). Changing it does not regenerate the runs, so it can disagree with them |
| `optimizationResults` | string? | **Two meanings** (MCP-12): the UI's English Markdown report from the Bayesian optimiser (`ProjectOptimization.tsx:636`), or MCP `optimize_desirability`'s one-line summary (`doeMcpServer.ts:923`). The last writer wins |
| `optimizationCandidates` | `Record<factorId, string \| number>[]`? | Suggested settings. The UI writes Bayesian suggestions with numbers rounded to 2 decimals (`ProjectOptimization.tsx:571`, STAT-19). MCP writes the top 5 desirability settings, which can miss factors (`doeMcpServer.ts:916-922`, MCP-11). "Append" turns them into runs and clears the field (`ProjectOptimization.tsx:645-663`) |
| `robustnessState` | `any` | Written only by the Robustness tab (`RobustnessSimulation.tsx:79-101`), including on first open (DATA-15). Shape below. MCP neither reads nor writes it |
| `isArchived` | boolean? | Hidden from the main lists and shown under `#/?folder=archive` (`Dashboard.tsx:37-42`). "Delete" on a non-archived project archives it; on an archived one it hard-deletes (`ProjectContext.tsx:197-220`). MCP `delete_project` always hard-deletes (MCP-4) |
| `createdAt`, `updatedAt` | number | ms since epoch. `updatedAt` is set by the client `saveProject` (mutating its argument, DATA-14), by `POST /api/projects`, and by process A's MCP context. It is not set by socket writes or by the stdio MCP context (MCP-20) |

`robustnessState` shape (as-is; the user inputs are stored as strings, the simulation results as numbers):

```ts
{
  selectedResponseId: string;          // a response id, or 'joint' for all responses
  nominalSettings: Record<factorId, string>;
  standardDeviations: Record<factorId, string>;
  specLimits: Record<responseId, { lsl: string; usl: string }>;
  numSimulations: string;              // default '10000'
  includeResidualNoise: boolean;       // default false (STAT-9)
  simulationResults: null
    | { isJoint: true;  runsCount; defectRate; jointOutOfSpec; individualStats; includeResidualNoise }
    | { isJoint: false; mean; sd; defectRate; belowLSL; aboveUSL; histogram; lsl; usl; includeResidualNoise };
}
```

### 4.2 Statistical model conventions (contract)

- The model is the intercept, all main effects and all two-factor interactions, minus `Response.excludedTerms`. There are no quadratic terms (`analysisCore.ts:200-319`, STAT-3).
- **Term IDs:** a main effect's ID is `Factor.id`. A two-factor interaction's ID is `${fa.id}*${fb.id}`, where `fa` comes before `fb` in `project.factors` (`analysisCore.ts:220, 278-279`). Reordering factors changes interaction IDs and silently orphans exclusions (DATA-11). A new term kind (for example quadratic) MUST have its ID format defined here before it is implemented.
- Display column names (`Name`, `Name[level]`, `A*B`) are labels, not IDs (MCP-7).
- **Factor coding** (`getFactorContrasts`, `analysisCore.ts:51-87`):
  - Numeric: `2(x − mid)/range`, clamped to [−2, 2].
  - Two-level categorical: level 0 → −1, level 1 → +1.
  - Categorical with L ≥ 3 levels: sum-to-zero coding with L−1 columns. Level j < L−1 has +1 in column j; the last level is the reference with −1 in all columns.
- Analysis results are never persisted. They are recomputed from the project by `computeAnalysis(project, response, excludedTerms, goal, targetValue)` (`analysisCore.ts:186`), which returns an untyped object (`:1153-1184`) or `null` when there is no data. Its field `p` is the model degrees of freedom, not a p-value (MCP-1; the HTML report prints it as "Model p-value", UI-31).
- Not persisted: the Analysis goal/target override (`customOptConfig`, `ProjectAnalysis.tsx:174`), the active tab and selected response (`ProjectView.tsx:21-22`, UI-25), optimiser settings and `targetRuns`.

### 4.3 Factor range and name conventions (DATA-22, DATA-23)

These were found while writing this spec and are now registered.

- **Categorical `Factor.min`/`max` has no single convention (DATA-22).** The UI stores `0`/`levels.length-1` (`ProjectSetup.tsx:76-77, 115-116`, sample `sampleProject.ts:51-52`). MCP `create_project` stores the zod defaults `0`/`100` when the caller omits them (`doeMcpServer.ts:229-230`), and the direct JSON-RPC path stores `undefined` (MCP-5). Code that falls back to `(min+max)/2` for a categorical factor then picks a different level depending on how the project was created. For example, MCP `simulate_robustness` (`doeMcpServer.ts:1015`) feeds 1 (the middle level) for a UI-created 3-level factor but 50 for an MCP-created one, and 50 falls through to level 0 in `getFactorContrasts` (`analysisCore.ts:65-67`). Fix (backlog P1.10): define categorical `min = 0`, `max = levels.length − 1` (or ignore min/max for categoricals) and enforce it in the shared schema (DATA-7). Confirmed by reading.
- **Factor and response names are not required to be unique, but several paths key by name (DATA-23).** Neither the Setup tab nor MCP `create_project` checks for duplicates. Yet MCP `optimize_desirability` builds its candidates as `namedFactors[f.name]` (`doeMcpServer.ts:897-900`) and then saves `optimizationCandidates` as `rawSetting[f.id] = c.factors[f.name]` (`:916-921`). With two factors of the same name, both saved settings get the second factor's value. The same applies to `predicted[r.name]` for responses (`:885`). Name-based lookups (MCP `resolveFactorId`/`resolveResponse`, `doeMcpServer.ts:72-87`; Excel import header matching, `ProjectDesign.tsx:254-292`) silently take the first match. Fix (backlog P1.10): require unique, trimmed, case-insensitive names in the shared schema and the Setup form, and key internal maps by id. Confirmed by reading.

## 5. Persistence and sync protocol (as-is)

### 5.1 Where data lives

| Store | Content | Written by | Read by |
|---|---|---|---|
| `<cwd>/data.json` | `{projects, folders}`, pretty-printed JSON, no version. Gitignored (`.gitignore`); an AI Studio sync may still commit it, which R9 reports | Process A `saveData` (`server.ts:62-68`) and process B `saveData` (`stdio.ts:32-38`): synchronous whole-file `writeFileSync`, not atomic (DATA-2) | Each process, once at start |
| Process A memory (`db: any`, `server.ts:25`) | Same | REST, socket.io and HTTP MCP handlers | REST GETs, `sync_data` |
| Process B memory (`db: any`, `stdio.ts:10`) | Same | stdio MCP tools | stdio MCP tools |
| localStorage `doe_magic_projects` | `Project[]` cache | `ProjectContext.tsx` on every mutation and server sync | Initial client state (`ProjectContext.tsx:21, 24-47`) |
| localStorage `doe_magic_folders` | `Folder[]` cache | Same | `ProjectContext.tsx:22, 49-68` |
| localStorage `app_language` | Locale code | `LanguageContext.tsx:29` | `LanguageContext.tsx:16` (accepts `en`, `zh`, `de`, `es`, `fr`, `it`) |
| localStorage `darkMode` | `'true'` or `'false'` | `Layout.tsx:33, 36` | `Layout.tsx:27` |
| localStorage `axiom_doe_sop_steps_v1` | SOP guide steps (JSON) | `GuideView.tsx:106` | `GuideView.tsx:82`. Never sent to the server (DATA-19) |

On Cloud Run (AI Studio deploy) `data.json` is on the container's temporary filesystem (DATA-9).

### 5.2 Server bootstrap

Process A (`server.ts:24-60`):

1. Read and parse `<cwd>/data.json` if it exists. A parse error is only logged, and the server continues with an empty store (DATA-2). A file that parses to a non-object such as `null` crashes startup instead (SRV-13).
2. If `projects` is empty, seed `sampleProjects`; otherwise re-add any sample project whose id is missing. Do the same for folders (`:36-56`, DATA-13). Samples are inserted by reference (DATA-14).
3. Purge the legacy ids `proj-api-synthesis-01` and `folder-synthesis` (`:58-60`, DATA-12).

Process B (`stdio.ts:10-30`) differs: it seeds only when the store is empty, its `saveProject` does not set `updatedAt`, and `broadcastSync` is a no-op (MCP-20).

### 5.3 Client protocol (`src/web/state/ProjectContext.tsx`)

| Step | Behaviour | Lines |
|---|---|---|
| Initial state | From the localStorage cache: drop the legacy id, check every entry has `id` and array `factors`/`responses`/`runs`, prepend the demo project and folder if missing. Otherwise use the samples | `:24-68` |
| Load | `GET /api/data`. If it has ≥1 project, replace state and cache wholesale. If it has 0, POST the first cached project and first cached folder back to the server (DATA-13) | `:82-123` |
| Live sync | `io({transports: ['polling','websocket'], timeout: 4000, reconnectionAttempts: 3})`. On `sync_data` with ≥1 project, replace state and cache wholesale. A `sync_data` with 0 projects is ignored. After 3 failed reconnects the client stops and nothing handles it, so the tab gets no more `sync_data` until reloaded (DATA-21) | `:127-145` |
| Save project | Set `project.updatedAt` (mutating the argument), upsert into state and cache, then `POST /api/projects` **and**, if connected, `socket.emit('update_project')`. Errors are only `console.warn`, and `res.ok` is not checked (DATA-5, DATA-8) | `:172-195` |
| Delete project | Not archived → save with `isArchived: true`. Archived → remove locally, `DELETE /api/projects/:id`, and `socket.emit('delete_project')` | `:197-220` |
| Save or delete folder | Same pattern with `/api/folders` and `update_folder`/`delete_folder`. Deleting unsets `folderId` locally | `:222-267` |
| Reset samples | Replace local state with the samples and `POST /api/reset-sample`, which wipes the server for every user. Called by both "demo" buttons (DATA-1, UI-1) | `:269-281` |
| Load demo | Additive upsert of the demo project. No callers (UI-1) | `:283-312` |

Many fields save on every keystroke (DATA-8, SRV-9).

### 5.4 Server write semantics

| Channel | Validation | Effect | Broadcast |
|---|---|---|---|
| `POST /api/projects` | Body must have `id` (400 otherwise) | Sets `updatedAt`, upserts the whole object, writes the file | `io.emit('sync_data', db)` to **all** clients, including the sender |
| `DELETE /api/projects/:id` | None. An unknown id still returns success | Hard delete, writes the file | All clients |
| `POST /api/folders`, `DELETE /api/folders/:id` | `id` required on POST | Upsert, or delete and unset `folderId` on its projects | All clients |
| `POST /api/reset-sample` | None, body ignored | Replaces **all** projects and folders with the samples | All clients |
| socket `update_project` / `update_folder` | **None** (DATA-7) | Upsert the whole object (no `updatedAt`), write the file | `socket.broadcast.emit` to all **other** clients |
| socket `delete_project` / `delete_folder` | None | Delete (folder delete unsets `folderId`), write the file | Other clients |
| MCP write tools in process A | Per-tool zod schemas, skipped on `POST /api/mcp` (MCP-5) | `mcpContext.saveProject` sets `updatedAt`, upserts, writes the file (`server.ts:207-228`) | All clients, twice per write (MCP-23) |
| MCP write tools in process B | Per-tool zod schemas | Own memory copy, file rewritten | None (DATA-3) |

Consistency model: every write replaces the whole project object (last writer wins). There is no revision check (DATA-4), no shape validation (DATA-7), no change history (DATA-16) and no backup. Every write rewrites the whole file and broadcasts the whole database (SRV-9).

### 5.5 Rules for changing persistence

- A change MUST keep existing `data.json` files, localStorage caches and exported project JSON readable. A change to stored shapes MUST come with a migration once `src/core/migrations.ts` exists (DATA-12). Until then, new fields MUST be optional and old values MUST keep their meaning.
- New storage keys, file formats, REST routes or socket events MUST be added to §5 and §6 before or in the PR that introduces them.
- Browser code writes only through `ProjectContext` (later `src/web/state/`). Server code writes only through the store context (`McpDatabaseContext` today, `src/server/store/` later). Do not add another writer to `data.json`.
- New code MUST NOT mutate shared objects in place, such as sample constants or a project received as an argument. Work on a copy (DATA-14).
- Any new destructive action (reset, regenerate, import-replace, delete) MUST ask for confirmation in the UI and MUST NOT run unasked from MCP (DATA-1, DES-1, UI-2, MCP-10).

## 6. External interfaces

### 6.1 REST (`server.ts`)

All routes are unauthenticated, CORS allows every origin, and the server listens on `0.0.0.0` (SRV-1). The JSON body limit is 50 MB (`:13`).

| Method and path | Request | Response | Lines |
|---|---|---|---|
| `GET /api/health` | — | `{status:'ok'}` | `:124-126` |
| `GET /api/data` | — | Whole store `{projects, folders}` | `:129-131` |
| `GET /api/projects` | — | `Project[]` | `:133-135` |
| `POST /api/projects` | `Project` with `id` | `{success:true, project}` or 400 `{error}` | `:137-152` |
| `DELETE /api/projects/:id` | — | `{success:true}` | `:154-160` |
| `GET /api/folders` | — | `Folder[]` | `:162-164` |
| `POST /api/folders` | `Folder` with `id` | `{success:true, folder}` or 400 `{error}` | `:166-180` |
| `DELETE /api/folders/:id` | — | `{success:true}` | `:182-192` |
| `POST /api/reset-sample` | — | `{success:true, data}`. **Destructive for all users** | `:194-202` |
| `GET /mcp/sse`, `GET /api/mcp/sse` | — | MCP SSE stream. Each connection gets its own MCP server and session, and is told to POST to `/api/mcp/messages` | `:233-257` |
| `POST /mcp/messages`, `POST /api/mcp/messages` | JSON-RPC, with `?sessionId=` or an `x-session-id` header | SDK transport response; 400 without a session id, 404 for an unknown one | `:259-282` |
| `POST /mcp`, `POST /api/mcp` | One JSON-RPC request: `initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`, `ping` | JSON-RPC response from `handleDirectJsonRpc` (`doeMcpServer.ts:1319`). Non-conformant and unvalidated (MCP-5, MCP-17) | `:284-299` |
| `GET /mcp/info`, `GET /api/mcp/info` | — | `{status, name, version, protocolVersion, activeSessions, endpoints, toolsCount, tools, resources, prompts}`, built from private SDK fields (MCP-17) | `:301-343` |
| `GET /api/mcp/logs` | — | In-memory activity log, newest first, at most 100 entries (MCP-21) | `:345-348` |
| `GET *` (production only) | — | `dist/index.html`, also for unknown `/api/*` paths (SRV-7) | `:369-371` |

### 6.2 socket.io

The client connects to the default `/socket.io` path on the page's origin. There are no rooms and no auth.

| Direction | Event | Payload |
|---|---|---|
| Server → client | `sync_data` | Whole store `{projects, folders}`. Sent on connect to that socket (`server.ts:75`) and after every write (§5.4) |
| Client → server | `update_project` | `Project` |
| Client → server | `delete_project` | Project id |
| Client → server | `update_folder` | `Folder` |
| Client → server | `delete_folder` | Folder id |

### 6.3 MCP

Server name `doe-magic-mcp`, version `1.5.2` (`doeMcpServer.ts:47-59`). The same server definition (`createDoeMcpServer`) is exposed over SSE and direct JSON-RPC by process A, and over stdio by process B. The tool contracts, transports and known defects are in [mcp-server.md](../../context/DOE-Magic/mcp-server.md).

| Kind | Names |
|---|---|
| Read-only tools | `list_projects`, `get_project`, `run_analysis`, `predict_response`, `simulate_robustness` |
| Writing tools | `create_project`, `update_project`, `delete_project` (hard delete), `generate_doe_design` (replaces all runs), `add_run_results`, `optimize_desirability` (writes `optimizationCandidates`/`optimizationResults`) |
| Resources | `doe://projects`, `doe://project/{id}`, `doe://analysis/{projectId}/{responseId}` |
| Prompts | `interpret_doe_results`, `recommend_doe_design` |

Changing a tool's name, inputs, defaults or output fields is a contract change (§9). An MCP tool MUST call the same `src/core` function the UI uses for the same result.

### 6.4 Files the app reads and writes

| File | Direction | Format | Where |
|---|---|---|---|
| Project JSON | Export | The raw `Project`, with no format or version marker (DATA-10) | `ProjectView.tsx:44-52` |
| Project JSON | Import | Requires array `factors`, `responses` and `runs`. Assigns a new `id`, `createdAt` and `updatedAt`, and keeps every other field | `Dashboard.tsx:73-105` |
| Excel workbook | Export | `xlsx-js-style`, English labels (UI-8, STAT-17, I18N-2) | `ProjectView.tsx:54-353` |
| Excel run matrix | Import | SheetJS `xlsx`, matched by factor and response name, **replaces all runs** (DATA-6, UI-12, BLD-3) | `ProjectDesign.tsx:200` (`handleImportExcel`) |
| HTML report | Export | Single HTML file with the project and analysis results embedded as JSON (`htmlExport.ts:318-319`). Loads Plotly and Tailwind from CDNs (UI-21) and opens in English (I18N-2) | `src/web/features/export/htmlExport.ts:6`, called at `ProjectView.tsx:356` |
| SOP steps JSON | Import and export | Guide page only | `GuideView.tsx` |

## 7. Build, run and deploy

### 7.1 Commands

| Command | Runs | Result |
|---|---|---|
| `npm install` | — | Installs dependencies. Both `package-lock.json` and `bun.lock` are tracked; which one AI Studio uses is undecided (BLD-7) |
| `npm run dev` | `tsx server.ts` | Process A in development mode at http://localhost:3000 |
| `npm run build` | `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` | `dist/index.html`, `dist/assets/*` and copies of `public/*`, plus `dist/server.cjs` and `dist/server.cjs.map`. The server bundle is in the publicly served folder (SRV-2, BLD-2) |
| `npm start` | `node dist/server.cjs` | Does **not** set `NODE_ENV` and so runs the development path (SRV-3, BLD-1). Use `NODE_ENV=production npm start` (bash) or `$env:NODE_ENV='production'; npm start` (PowerShell; afterwards close the window or run `Remove-Item Env:NODE_ENV`, otherwise a later `npm run dev` there serves the old `dist/`) |
| `npm run mcp` | `tsx src/server/mcp/stdio.ts` | Process B. npm prints a banner on stdout before the JSON-RPC stream; the client snippet in the MCP panel lacks a working directory (MCP-18) |
| `npm run lint` | `tsc --noEmit` | Type check only |
| `npm run check` | `tsc --noEmit && node scripts/check-boundaries.mjs` | Type check and layer rules (§3.2). Required before every commit |

### 7.2 Development vs production (process A)

| | Development (`NODE_ENV` ≠ `production`) | Production (`NODE_ENV=production`) |
|---|---|---|
| Front end | `createViteServer({server: {middlewareMode: true, hmr: {server: httpServer, clientPort}}, appType: 'spa'})`, which merges `vite.config.ts` (`server.ts:351-365`) | `express.static(<cwd>/dist)` and an `index.html` fallback for every other GET (`server.ts:366-371`) |
| HMR client port | 443 if `K_SERVICE` or `APP_URL` is set (Cloud Run / AI Studio), otherwise 3000 (`server.ts:353-354`) | — |
| Runtime needs | `vite` and dev tooling installed | `node_modules` (packages are external to the bundle). A Node version with `require(esm)` on by default (≥ 22.12, or ≥ 20.19 on the 20.x line), because the CJS bundle `require()`s ESM-only `uuid` (SRV-6, BLD-13). Confirmed by running: `node --no-experimental-require-module dist/server.cjs` fails with `ERR_REQUIRE_ESM` on `node_modules/uuid/dist-node/index.js`. The README asks for 22.12 |

Environment variables actually read by code: `NODE_ENV` (`server.ts:351`), `K_SERVICE` and `APP_URL` (`server.ts:353`), and `DISABLE_HMR` (`vite.config.ts:18-20`; the inline `hmr` object in `server.ts` overrides it, SRV-10, plausible-unverified). `PORT` is ignored and `.env` is never loaded (SRV-8). `GEMINI_API_KEY` (`.env.example`) is not read by any code (BLD-10).

### 7.3 Deploy

The code expects to run in Google AI Studio and on Cloud Run (the `K_SERVICE`/`APP_URL` checks). How the owner actually deploys is unverified. A deployed instance is not durable storage (DATA-9) and is open to anyone who can reach it (SRV-1).

### 7.4 AI Studio constraints (MUST NOT break)

The owner keeps AI Studio compatibility. These hold until the owner decides otherwise:

1. **Root files stay where they are:** `server.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `metadata.json`, `.env.example`, `public/` (`logo.png`, `plotly.min.js`), `assets/.aistudio/`, and `src/main.tsx` (the template's Vite entry). Keep the npm script names `dev`, `build` and `start`. How AI Studio invokes them is unverified.
2. **Port 3000.** `PORT = 3000` is hard-coded (`server.ts:8`), listening on `0.0.0.0` (`server.ts:374`). Reading `process.env.PORT` with a default of 3000 is allowed (SRV-8). Changing the default is not.
3. **Paths resolve from `process.cwd()`**, which must be the repo root: `data.json` (`server.ts:9`, `stdio.ts:8`) and `dist` (`server.ts:367`). Start every process from the repo root.
4. **The `DISABLE_HMR` block in `vite.config.ts:15-21` is marked "Do not modify".** Leave it unchanged. The garbled dash in the comment at `:17` is BLD-14.
5. **HMR `clientPort` 443 on Cloud Run** (`server.ts:353-354`): AI Studio's preview is proxied over HTTPS.
6. **`base: "./"`** in `vite.config.ts:8` stays. Root-absolute paths still exist (`/plotly.min.js`, `/logo.png`, `/api`, `/socket.io`), so the app only works at a domain root (SRV-12).
7. **The inline script in `index.html:12-32`** suppresses Vite HMR WebSocket errors in the AI Studio proxy. Keep it.
8. **Tailwind scans only `src/`:** `@import "tailwindcss" source("..");` in `src/web/index.css:2` (relative to the CSS file, so `..` is `src/`). A class that appears only outside `src/` is not generated. Keep the `source("..")`. See [the lesson](../../memory/DOE-Magic/tailwind-scans-whole-repo.md).
9. **`metadata.json` and `.env.example` keep their Gemini entries** until someone checks how AI Studio reacts to removing them (BLD-10, SRV-11).
10. **AI Studio sync overwrites the repo.** Its GitHub sync pushes the whole workspace snapshot (commit ef15736 deleted the README this way). Before switching, every real project MUST be exported with Export JSON: a new or re-imported workspace has no `data.json`, so the server seeds only the demo project, and the browser cache is overwritten by server data on load. After this restructuring merges, the AI Studio project MUST be re-imported or started fresh from `main` before any further AI Studio edits, and the projects brought back with Import Project (exact AI Studio steps unverified). The sync may ignore `.gitignore` (in `ef15736` it committed `assets/.aistudio/.gitignore`, a file that ignores itself), so `.gitignore` only keeps files out of commits made with git; R9 fails if `.aistudio/` or `data.json` is tracked again. See [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md) and [the lesson](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md).

## 8. i18n contract

As-is mechanism (`src/web/i18n/`):

- `useTranslation()` returns `{locale, setLocale, t, supportedLanguages, currentLanguage}` (`LanguageContext.tsx:4-10, 62-68`).
- `t(key, fallback?, params?)` looks up `translations[locale][key]`, then `translations.en[key]`, then `fallback`, then `key` itself. It chains these with `||`, so an empty string falls through (`LanguageContext.tsx:40-53`, I18N-6).
- `params` replaces `{name}` placeholders. No caller uses it yet.
- Dictionaries: `translations.en` (`translations.ts:17`) and `translations.zh` (`:226`). Keys are snake_case. The selector offers only `en` and `zh` (`:11-14`); `de`, `es`, `fr` and `it` are empty stubs (`:436-439`).
- The locale is stored in localStorage `app_language`. On first visit it comes from `navigator.language` (`zh*` → `zh`, otherwise `en`). It sets `<html lang>` to `zh-CN` or the locale code.
- Only 6 files call `t()`. About 600 inline `locale === 'zh' ? … : …` branches bypass the dictionary (I18N-1). The HTML export has its own dictionary (`htmlExport.ts:321-408`, I18N-3).

Rules for new and changed code:

1. Every new user-visible string in `src/web` MUST go through `t('key', 'English fallback', params)`, with the key added to **both** `translations.en` and `translations.zh` in the same PR. This covers labels, tooltips, toasts, errors, confirm dialogs and chart titles.
2. New code MUST NOT add `locale === 'zh'` ternaries or inline `{en, zh}` objects. When you touch an existing ternary, move it to `t()` if the change is small. Bigger migrations are separate per-feature PRs (I18N-1).
3. Keys are snake_case and SHOULD start with the feature or area (`analysis_…`, `design_…`, `robustness_…`). Reuse an existing key when its meaning matches (I18N-5).
4. Use `params` for values (`t('runs_count', '{n} runs', {n})`). Do not build sentences by concatenation.
5. These terms stay in English in both languages: **DOE, ANOVA, OLS, R², RMSE, Cpk, DSD, CCD, BBD**. Chinese text may add a translation in parentheses, as existing strings do (`'制程能力指数 (Cpk)'`).
6. `src/core` and `src/server` MUST NOT import i18n (R3, R4). New core functions return codes and parameters (for example `{severity, code, params}`, UI-17), and the UI translates them. MCP tool output stays English, because it is written for agents.
7. Do not add strings for `de`, `es`, `fr` or `it` until the owner adds a language (I18N-6).

## 9. Change process

1. **Scope.** Every PR is either **move-only** (renames plus the import-specifier edits they force, with no logic change) or a **logic change**. Never both. A move-only PR MUST show: `tsc` with 0 errors, `npm run build` OK with an unchanged JS bundle size, and `git diff -M` showing renames. Edit import strings in place so line numbers stay the same and file:line references remain valid.
2. **Contract first.** Before implementing a change to a contract surface (§1), update the doc that defines it, in the same PR and ahead of the code. Which doc:
   - persisted data, storage keys, file formats, REST, socket and layer rules: this spec;
   - statistical semantics (model terms, term IDs, score or statistic definitions, p-values, effect scales, desirability, Lenth, Monte Carlo): the [statistics engine](../../context/DOE-Magic/statistics-engine.md) or [design generation](../../context/DOE-Magic/design-generation.md) doc;
   - MCP tool names, inputs, defaults and outputs: [mcp-server.md](../../context/DOE-Magic/mcp-server.md).
3. **Issue IDs.** Reference the registry ID in the commit message and PR (for example `fix(stats): STAT-2 Lenth pseudo-error scale`). Never renumber IDs. A newly found problem goes into the [backlog](roadmap-backlog.md) as a new entry before or with its fix.
4. **Checks.** Before finishing, run `npm run check` and `npm run build`. For UI changes, also run `npm run dev` and exercise the affected tab at http://localhost:3000. For MCP changes, call the tool over `POST /api/mcp` **and** over SSE or stdio, because the direct path skips zod (MCP-5).
5. **Statistics changes need a reference.** A change to a computed number MUST be checked against an independent reference: JMP, R, or a published worked example with its source cited. Until a test runner exists (BLD-4), put the reference comparison in the PR description (input data, reference tool and version, expected and actual values). Once tests exist, the comparison MUST be a committed test. Never "fix" a number without a test that pins the correct value.
6. **One implementation per calculation**, in `src/core` (§3.3). When you fix one copy of a duplicated calculation, replace the other copies with calls to it rather than patching each one.
7. **No scratch files in the repo.** Never commit one-off patch, debug or dump scripts, or test outputs. Use a scratch directory outside the repo. `scripts/` holds only maintained tools that a `package.json` script references. R9 rejects any new tracked entry at the repo root (§3.2). See [the lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md).
8. **Dependencies.** When `package.json` changes, update both lockfiles until BLD-7 is decided, or state in the PR that `bun.lock` was not updated. `npm ci` MUST succeed. See [the lesson](../../memory/DOE-Magic/lockfile-drift.md).
9. **Runtime data stays out of git.** `data.json`, `.env*` (except `.env.example`), `dist/` and build or verification folders are never committed. See [the lesson](../../memory/DOE-Magic/runtime-data-in-git.md).
10. **Docs follow behaviour.** A PR that changes behaviour updates the context doc that describes it, the status doc if a critical issue changes state, and adds a memory entry (mistake → root cause → prevention) when a mistake is worth preventing.
11. **AI Studio.** Changes MUST respect §7.4. After a merge that changes structure, the AI Studio workspace MUST be refreshed from `main` before anyone edits there again.
