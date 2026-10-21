# DOE-Magic — Web UI

> Created: 2026-10-20. Status: Reference for the browser layer `src/web/` as of branch `chore/project-structure-and-core-docs`. It describes current behaviour; none of the listed issues is fixed yet.
> Related: [Design spec](../../spec/DOE-Magic/design-spec.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Statistics engine](statistics-engine.md), [Design generation](design-generation.md), [Server and persistence](server-and-persistence.md), [MCP server](mcp-server.md), [AI Studio origin](ai-studio-origin.md), [Forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md), [AGENTS.md](../../../AGENTS.md)

The UI is a React 19 single-page app: HashRouter, Tailwind v4, Recharts, and Plotly for the contour/3D surface plots only. It has 3 routes, 6 project tabs and an MCP panel. All project data lives in one React context, which writes the whole project to `localStorage`, REST and socket.io on every edit. Most statistics come from `src/core/analysis/analysisCore.ts`. However, a lot of domain logic (design generation, Bayesian optimisation, Monte Carlo, diagnostics, plot data) still sits inside the components, often in two or three diverging copies. About 600 inline `zh`/`en` branches bypass the translation dictionary.

Line numbers below were checked against the current files. The 2,697-line `ProjectAnalysis.tsx`, the 1,632-line `ProjectDesign.tsx` and the 1,479-line `htmlExport.ts` hold most of the logic.

## 1. Boot, providers and routing

| Step | Where | What happens |
|---|---|---|
| HTML shell | `index.html:8`, `index.html:12-32`, `index.html:36` | A classic `<script src="/plotly.min.js">` loads in `<head>`. An inline script suppresses Vite HMR WebSocket errors in AI Studio previews. The module entry is `/src/main.tsx`. |
| Entry | `src/main.tsx:1-10` | `createRoot(#root).render(<StrictMode><App/></StrictMode>)` and imports `./web/index.css`. |
| CSS | `src/web/index.css:1-4`, `:21` | Loads Google Fonts (Inter, JetBrains Mono) from the internet. Tailwind is scanned only under `src/` (`source("..")`). Brand colours come from `@theme`. Dark mode is a class variant: `.dark` on `<html>`. |
| Providers | `src/web/App.tsx:17-29` | `LanguageProvider` > `ProjectProvider` > `HashRouter` > `Routes`. There is no app-level error boundary (UI-23). |
| Shell | `src/web/Layout.tsx` | Sidebar, `<Outlet/>` and an always-mounted `McpModal` (`:186`). Dark mode is stored in `localStorage.darkMode` (`:26-38`). |

Routes (HashRouter, so URLs look like `/#/project/<id>`):

| Path | Element | Notes |
|---|---|---|
| `/` (index) | `src/web/pages/Dashboard.tsx` | `?folder=<id>` filters by folder. `?folder=archive` shows archived projects (`Dashboard.tsx:31-44`). |
| `/project/:id` | `src/web/pages/ProjectView.tsx` | Shows "Experiment not found" if the id is unknown (`ProjectView.tsx:28`). |
| `/guide` | `src/web/pages/GuideView.tsx` | SOP step editor. |

All three routes render inside `Layout` (`App.tsx:21`). There is no catch-all route. The active project tab is not in the URL (UI-25).

## 2. Screen → file map

| Screen / element | How the user gets there | File (lines) | Notes |
|---|---|---|---|
| Sidebar | Always visible | `src/web/Layout.tsx:56-175` | Logo, "Current Experiment" name, All Experiments, folder list with create (`:40-47`) and delete (`:49-51`, no confirm), Archive link, link to the open project, Guide link, `LanguageSelector`, MCP button (`:152-159`), dark-mode toggle |
| Language menu | Sidebar | `src/web/i18n/LanguageSelector.tsx:71+` | Lists `SUPPORTED_LANGUAGES` where `isAvailable` (en, zh) |
| Dashboard | `#/` | `src/web/pages/Dashboard.tsx` | Filter, search and sort (`:34-68`); JSON import (`:73-105`); create project (`:107-122`); cards with archive/restore/move/delete (`:245-327`); the "Demo Studies" toolbar button (`:181`) and the empty-state "Load Demo Experiments" button (`:343`) both call `resetSampleData` (UI-1) |
| Archive | `#/?folder=archive` | `Dashboard.tsx:37-38`, `:270` | The trash icon on an archived card hard-deletes (`ProjectContext.tsx:201-215`) |
| Project header | `#/project/:id` | `ProjectView.tsx:378-460` | Inline rename (`:30-41`, saved on blur); Export JSON, Excel and HTML buttons (`:438-458`) |
| Project tabs | Tab bar | `ProjectView.tsx:367-374`, `:462-482`, `:484-491` | See the table below |
| Guide | Sidebar "Step-by-Step Guide" | `src/web/pages/GuideView.tsx` | SOP steps live in `localStorage.axiom_doe_sop_steps_v1` (`:21`, `:80-107`) and start empty (`:23`); add/edit/move/clear/undo; JSON download (`:225-233`) and upload (`:243-262`); "launch module" ignores its target (UI-26, `:265-271`) |
| MCP panel | Sidebar "MCP Server" | `src/web/features/mcp-panel/McpModal.tsx` | Modal with tabs `overview`, `tools`, `resources`, `logs` (`:28`). Loads `GET /api/mcp/info` and `/api/mcp/logs` on open (`:51-75`). The tool playground sends `POST /api/mcp` `tools/call` (`:137-149`) with per-tool default args aimed at the demo project (`:78-113`). Shows an SSE URL `${origin}/mcp/sse` (`:42`) and a stdio snippet `{command:'npm', args:['run','mcp']}` (`:178-189`, MCP-18). |

The six project tabs (`ProjectView.tsx:367-374`; display order as below). The English labels in the table are the ones the interface shows: they come from `translations.ts:96-101`. The fallbacks written in `ProjectView.tsx:368-373` ("Design Matrix", "Analysis", "Robustness / Monte Carlo") are never shown in English or Chinese, because both dictionaries define every `tab_*` key. Each tab is mounted only while active (`:485-490`), so its local state resets on every tab switch. None of them has a `key={project.id}`.

| Tab id | Label key (English) | Component | Props | Writes the project? | Main sections (lines) |
|---|---|---|---|---|---|
| `setup` | `tab_setup` (Setup) | `src/web/features/setup/ProjectSetup.tsx` | `project`, `updateProject` | Yes | Factor add/edit/delete (`:48-84`, `:103-143`); response add/edit/delete (`:86-101`, `:145-163`); centre-point count (`:172-186`, saved on every keystroke at `:182`) |
| `design` | `tab_design` (Experiment Matrix) | `src/web/features/design/ProjectDesign.tsx` | `project`, `updateProject` | Yes | Config panel (`:1145+`): design-type select (`:1158-1185`), Generate (`:1188`), run count (`:1287`), `TwoLevelDesignSelector` (`:1383`), `DesignCube` (`:1425`); Excel import (`:1442-1447`); augment menu (`:1463-1469`); add run (`:1475`); run matrix with pattern column and data entry (`:1529-1627`) |
| `analysis` | `tab_analysis` (Model Analysis) | `src/web/features/analysis/ProjectAnalysis.tsx` (+ `PredictionProfiler.tsx`) | `project`, `selectedResponseId`, `onResponseChange`, `onUpdateProject`, `onNavigateTab` | Yes (term exclusion, quick entry, simulate) | Response selector (`:1065-1094`); without a fit: quick entry for the first 16 runs and "Simulate Sample Data" (`:1095-1218`, button `:1127`); diagnostics summary (`:1220`, built at `:584-1053`); Pareto/half-normal (`:1224`); tables (`:1465-1966`); main effects (`:1968`); interaction (`:2230`); residual plots (`:2312`); DOE mean (`:2320`); contour/3D surface (`:2372`); Profiler (`:2512`); optimal conditions (`:2518+`) |
| `compare` | `tab_compare` (Compare Responses) | `src/web/features/compare/CompareResponses.tsx` | `project` | No (read-only) | One plot type at a time (11 choices, `:105`), rendered for every response (`:503-1163`) |
| `robustness` | `tab_robustness` (Robustness & Simulation) | `src/web/features/robustness/RobustnessSimulation.tsx` | `project`, `updateProject` | Yes (`robustnessState`, autosaved) | Inputs (`:15-62`), models (`:70-75`), autosave (`:79-101`), `runSimulation` (`:103-282`) |
| `optimization` | `tab_optimization` (Bayesian Optimization) | `src/web/features/optimization/ProjectOptimization.tsx` | `project`, `updateProject` | Yes (`optimizationResults`, `optimizationCandidates`, appended runs) | Options (`:599-608`), run (`:616-643`), append suggestions (`:645-664`), Markdown report rendered with `react-markdown` + `remark-gfm` |

`selectedAnalysisResponseId` is lifted into `ProjectView` (`:22`), so the analysed response survives a tab switch. All other Analysis UI state does not (goal override `customOptConfig`, axis and plot choices: `ProjectAnalysis.tsx:166-175`).

## 3. State and data flow

**Who holds state.** `src/web/state/ProjectContext.tsx` owns `projects` and `folders`. Only `Layout`, `Dashboard`, `GuideView` and `ProjectView` call `useProjects()`. Feature components never read the context. They receive the `project` object and `saveProject` as a prop (`updateProject` / `onUpdateProject`, `ProjectView.tsx:485-490`). Every edit builds `{...project, <change>}` and passes the whole object up.

**Load sequence.**

1. The initial state comes from `localStorage` keys `doe_magic_projects` / `doe_magic_folders` (`ProjectContext.tsx:21-68`). The legacy ids `proj-api-synthesis-01` / `folder-synthesis` are dropped and the demo project/folder is prepended if missing. If any cached project fails a shallow shape check, the whole cache is replaced by samples (`:32`, `:46`).
2. `GET /api/data` (`:82-95`) replaces state wholesale when the server has at least one project. If the server has none, the client POSTs its first cached project and folder back (`:96-115`).
3. socket.io connects (`:127-131`). The server sends `sync_data` with the whole DB on connect (`server.ts:75`), and the handler replaces state whenever the list is non-empty (`ProjectContext.tsx:134-145`). `loading` starts `false` and is never set to `true` (`:74`).

**Write path (`saveProject`, `ProjectContext.tsx:172-195`).**

1. Mutates the argument (`project.updatedAt = Date.now()`, `:173`).
2. Upserts into React state and rewrites the whole `doe_magic_projects` array in `localStorage`.
3. `POST /api/projects` with the whole project. The server rewrites `data.json` and calls `io.emit('sync_data', db)` to every client, including the sender (`server.ts:137-151`).
4. If the socket is connected, `socket.emit('update_project', project)` sends the same data a second time. The server rewrites `data.json` again and broadcasts to the other clients (`server.ts:78-87`).

There is no revision check, no `res.ok` check and no user-visible error. Failures go to `console.warn` (`ProjectContext.tsx:189`). See DATA-4, DATA-5 and DATA-8.

**What triggers a save.**

| Trigger | Where | Frequency |
|---|---|---|
| Run-matrix factor/response cell | `ProjectDesign.tsx:1580`, `:1593`, `:1605` → `updateRunFactor` / `updateRunResponse` (`:1088-1130`) | Every keystroke that forms a complete number (`DecimalInput`, `:44-87`); every select change |
| Centre-point count | `ProjectSetup.tsx:180-183` | Every keystroke |
| Analysis quick entry | `ProjectAnalysis.tsx:1199` → `:237-254` | Every keystroke |
| Term exclude toggle | `ProjectAnalysis.tsx:1627-1637` | Per click |
| Robustness inputs and results | `RobustnessSimulation.tsx:79-101` | 500 ms debounce; also fires once when the tab is first opened (UI-9) |
| Design type, Generate, augment, import | `ProjectDesign.tsx:1175`, `:990`, `:1012`/`:1049`/`:1065`/`:1084`, `:404` | Per action; Generate and import replace all runs (UI-2) |
| Optimisation run / append | `ProjectOptimization.tsx:636`, `:659-663` | Per action |
| Factor/response edits | `ProjectSetup.tsx:60-101` | On Save (staged in local state first) |
| Rename, restore, archive (or hard delete), move, import, create | `ProjectView.tsx:32`; `Dashboard.tsx:94`, `:120`, `:254`, `:270`, `:284` | Per action |

**Other browser storage.** `app_language` (`LanguageContext.tsx:16`, `:29`), `darkMode` (`Layout.tsx:27-36`) and `axiom_doe_sop_steps_v1` (`GuideView.tsx:21`). SOP steps never reach the server (DATA-19).

**Not persisted:** the active tab, Analysis plot choices and goal override, and the optimisation options (`numSuggestions`, goal, target, margin, surrogate: `ProjectOptimization.tsx:599-608`).

## 4. Dependency graph

```
index.html → src/main.tsx → web/App.tsx
  LanguageProvider (web/i18n/LanguageContext → translations)
  ProjectProvider  (web/state/ProjectContext → core/types, core/sampleProject; fetch /api/*, socket.io)
  Layout → LanguageSelector, features/mcp-panel/McpModal (fetch /api/mcp*), assets/logo.png
    ├ pages/Dashboard   → state, i18n, core/types
    ├ pages/GuideView   → state, i18n
    └ pages/ProjectView → state, i18n, core/design/doePatterns, core/analysis/analysisCore,
                          features/export/htmlExport, xlsx-js-style (dynamic import), and the six tabs:
        features/setup/ProjectSetup                → core/types
        features/design/ProjectDesign              → ./TwoLevelDesignSelector (→ core/design/designMatrixData),
                                                     ./DesignCube, core/design/{doePatterns,dOptimal}, xlsx
        features/analysis/ProjectAnalysis          → ./PredictionProfiler (→ core/analysis), shared/ResidualsPlots,
                                                     shared/PlotlyErrorBoundary, core/analysis, react-plotly.js/factory, jstat (unused)
        features/compare/CompareResponses          → shared/ResidualsPlots, shared/PlotlyErrorBoundary,
                                                     core/analysis, react-plotly.js/factory
        features/robustness/RobustnessSimulation   → core/analysis
        features/optimization/ProjectOptimization  → core/types only; react-markdown, remark-gfm
        features/export/htmlExport                 → core/{design/doePatterns, analysis/analysisCore, types}, ./logoBase64
  (every .tsx file except main.tsx, DesignCube, PlotlyErrorBoundary and state/ProjectContext → web/i18n/LanguageContext;
   htmlExport.ts does not import it)
```

How the layer rules from the [design spec](../../spec/DOE-Magic/design-spec.md) apply today (`npm run check`, [`scripts/check-boundaries.mjs`](../../../scripts/check-boundaries.mjs)):

- No `src/web` file imports `src/server` (R5). The browser reaches the server only through `fetch` and socket.io.
- No feature imports another feature (R6). Code shared by Analysis and Compare is in `src/web/shared/`: `ResidualsPlots`, `PlotlyErrorBoundary`.
- `ProjectDesign` imports `dOptimal` but not `core/design/doeGenerator`. Only MCP uses that generator (see §6).
- `ProjectOptimization` imports nothing from `src/core` except types.

## 5. Domain logic still embedded in components

Each of these moves into `src/core/` as its own logic PR, after tests exist. Target paths are the "lands in" entries of the issue registry. Where the registry names two different paths, both are given; the first one is the name used by the [design spec's planned module map](../../spec/DOE-Magic/design-spec.md#33-where-does-new-code-go) and the [backlog](../../spec/DOE-Magic/roadmap-backlog.md), which win.

| Logic | Current location | Target | IDs |
|---|---|---|---|
| Design generator (D-optimal, CCD, BBD, PB, DSD, factorial) incl. biased shuffle | `ProjectDesign.tsx:451-991` (shuffle `:987`) | `src/core/design/doeGenerator.ts` (single generator) + `src/core/design/randomize.ts` | DES-8, MCP-19, UI-15, DES-7 |
| Run-count planner | `ProjectDesign.tsx:144-183`, reset effect `:446-449` | `src/core/design/planner.ts` | UI-15, DES-15 |
| Augmentation (centre, axial, replicate, empty run) | `ProjectDesign.tsx:994-1085` | `src/core/design/augment.ts` | UI-15 |
| Excel run-matrix import parser | `ProjectDesign.tsx:200-444` | `src/core/io/runMatrixImport.ts` (DATA-6) or `src/web/features/design/excelImport.ts` (UI-12) | DATA-6, UI-12, STAT-11 |
| Decimal parsing (comma → dot) | `ProjectDesign.tsx:17-140` (`DecimalInput`), `:1088-1106` | `src/core/io/parseNumber.ts` (backlog P1.12; the registry allows `src/web/shared/` or `src/core/`) | DES-13 |
| Synthetic response generator | `ProjectAnalysis.tsx:189-235` | Not in the registry; its behaviour changes first (UI-2) | UI-2 |
| Interaction-plot cell means | `ProjectAnalysis.tsx:283-383` | `src/core/analysis/effectPlots.ts` | UI-6, STAT-16 |
| DOE mean series | `ProjectAnalysis.tsx:386-394` | `src/core/analysis/effectPlots.ts` | UI-24, STAT-18 |
| Response-surface grid (+ linear-trend fallback) | `ProjectAnalysis.tsx:397-582` | `src/core/analysis/surfaceGrid.ts` | UI-18 |
| Diagnostics rule engine (saturation, overfit, LOF, Cook's D, VIF, hierarchy, Box-Cox, aliasing, balance) | `ProjectAnalysis.tsx:584-1053` | `src/core/analysis/diagnostics.ts` | UI-17, STAT-23 |
| Main-effect means (ignores `analysis.effects`) | `ProjectAnalysis.tsx:2020-2116` | `src/core/analysis/effectPlots.ts` | UI-7 |
| Desirability (per response and global) | `PredictionProfiler.tsx:13-40`, `:77-84` | `src/core/optimization/desirability.ts` (STAT-6, UI-5) or `src/core/analysis/desirability.ts` (MCP-3) | UI-5, STAT-6, MCP-3 |
| Monte Carlo robustness (Box-Muller, defect rate, histogram) | `RobustnessSimulation.tsx:103-282` | `src/core/robustness/monteCarlo.ts` (STAT-9, UI-9) or `src/core/analysis/robustness.ts` (MCP-2, MCP-16) | UI-9, STAT-9, MCP-16 |
| Bayesian optimiser (Cholesky, GP, EI, candidate search, Markdown report) | `ProjectOptimization.tsx:23-593` (report `:518-592`) | `src/core/optimization/bayesOpt.ts` (STAT-13) or `bayesian.ts` (UI-16) | UI-16, STAT-13, STAT-10 |
| Excel export (3 sheet types, runs `computeAnalysis` per response) | `ProjectView.tsx:54-353` | `src/web/features/export/excelExport.ts` | UI-8, STAT-17 |
| JSON export / import | `ProjectView.tsx:44-52`; `Dashboard.tsx:73-105` | `src/core/io/projectJson.ts` + `src/core/schema.ts` | DATA-10 |
| Report-side statistics (main effects, interaction, surface, level matching) | `htmlExport.ts:544-700`, `:1094-1221`, `:1223-1461`, `:473-479` | Precompute in core and embed (`surfaceGrid.ts`, `effectPlots.ts`) | UI-4, STAT-8 |

## 6. Duplicated logic

Background on why the forks drift: [forked-logic-drifts](../../memory/DOE-Magic/forked-logic-drifts.md).

| Logic | Copies | Verified divergence | IDs |
|---|---|---|---|
| Design generation | `ProjectDesign.tsx:451-991` vs `src/core/design/doeGenerator.ts:20-457` (MCP only) | 2-level test `=== 2` (`ProjectDesign.tsx:147`) vs `<= 2` (`doeGenerator.ts:38`); UI shuffles, core keeps standard order | DES-8, UI-15, MCP-19 |
| Interaction means | `ProjectAnalysis.tsx:342-371`; `CompareResponses.tsx:124-152`; `htmlExport.ts:1138-1147` | Analysis puts centre points in "low" (`<= mid`); Compare drops them (±1e-6) and uses `Number()`, so it shows nothing for categoricals; the export counts them in both | UI-6, STAT-16 |
| Main-effect means | `ProjectAnalysis.tsx:2020-2116`; `htmlExport.ts:544-700`; `analysis.effects` used by Compare (`CompareResponses.tsx:940`) | Analysis also accepts `String(idx)` / `String(idx+1)` as a level match (`:2035`, `:2047`); the export accepts only `String(idx)` (`:473-479`) | UI-7 |
| Surface grid and prediction | `ProjectAnalysis.tsx:397-582`; `CompareResponses.tsx:160-319`; `htmlExport.ts:1223-1461` | App copies call `predictModelResponse` (`ProjectAnalysis.tsx:491`, `CompareResponses.tsx:240`); the export sums main-effect estimates only (`htmlExport.ts:1287-1311`) | UI-4, UI-18, STAT-8 |
| Desirability | `PredictionProfiler.tsx:13-40`; `src/core/analysis/analysisCore.ts:757-782`; `src/server/mcp/doeMcpServer.ts:832-853` | Profiler uses observed min/max and ignores `targetValue` for maximize/minimize | UI-5, STAT-6, MCP-3 |
| Monte Carlo | `RobustnessSimulation.tsx:103-282`; `doeMcpServer.ts` `simulate_robustness` | Variance /N vs /(N-1); MCP clamps samples; different nominal defaults | UI-9, STAT-9, MCP-16 |
| Help tooltip | `ProjectAnalysis.tsx:32-115`; `CompareResponses.tsx:14-97` | Lack-of-fit help text differs | UI-19 |
| PNG download (`html-to-image`) | `ProjectAnalysis.tsx:119-165`; `CompareResponses.tsx:331-371`; `ResidualsPlots.tsx:9-41`, `:82-115` | `ResidualsPlots` uses fixed DOM ids (`:50`, `:123`) | UI-13, UI-19 |
| Stat tables + effects plot | `ProjectAnalysis.tsx:1224-1966` vs `CompareResponses.tsx:526-928` | Parallel JSX | UI-19 |
| Plotly component factory | `ProjectAnalysis.tsx:10`; `CompareResponses.tsx:12` | Identical | UI-19 |
| Default factor settings (centre / first level) | `PredictionProfiler.tsx:46-58`; `RobustnessSimulation.tsx:22-47` | Robustness keeps the first-open snapshot (UI-9) | UI-9 |
| Design-type display names | `ProjectView.tsx:56-63` (English); `htmlExport.ts:32-40` (en/zh); option labels in `ProjectDesign.tsx` | Three tables | I18N-3, DES-18 |
| Fitting every response | `ProjectAnalysis.tsx:257-281` (active response fitted twice), `CompareResponses.tsx:121`, `RobustnessSimulation.tsx:72`, `ProjectView.tsx:223`, `htmlExport.ts:9` | Only Analysis drops saved `excludedTerms` for non-active responses (`:262`) | UI-3, UI-29 |

## 7. Charts: Plotly from `public/plotly.min.js`, everything else Recharts

- `index.html:8` loads `public/plotly.min.js` (plotly.js v3.7.0, 4,855,045 bytes) as a render-blocking classic script on every route. Classic scripts run before the deferred module bundle, so `window.Plotly` exists when `ProjectAnalysis.tsx:10` and `CompareResponses.tsx:12` call `createPlotlyComponent((window as any).Plotly)` at module load.
- `react-plotly.js` is used only for its `factory`. The npm package `plotly.js-dist-min` (`package.json`) is never imported (BLD-5).
- Plotly draws only the contour/3D surface plots (`ProjectAnalysis.tsx:2448`, `CompareResponses.tsx:1086`). Both are wrapped in `src/web/shared/PlotlyErrorBoundary.tsx`, a WebGL fallback with English-only text that offers "Switch to 2D Contour Plot". Every other chart uses Recharts.
- The HTML export loads Plotly 2.27.0 and the Tailwind Play CDN from the internet (`htmlExport.ts:53-54`, UI-21), so reports render with a different Plotly version.
- The paths `/plotly.min.js` and `/logo.png` are root-absolute, while `vite.config.ts` sets `base: "./"` (SRV-12).
- Tailwind no longer scans `public/` (commit 818b8db; [tailwind-scans-whole-repo](../../memory/DOE-Magic/tailwind-scans-whole-repo.md)).

## 8. Exports and imports

| Artefact | Code | Language | Notes |
|---|---|---|---|
| Project JSON (export) | `ProjectView.tsx:44-52` | n/a | Raw `Project` as a `data:` URL; no format or version marker (DATA-10) |
| Project JSON (import) | `Dashboard.tsx:73-105` | Error text en/zh | Checks only that `factors`/`responses`/`runs` are arrays; new uuid; keeps `folderId`/`isArchived` (DATA-10, UI-23) |
| Excel workbook | `ProjectView.tsx:54-353` | English only | `import('xlsx-js-style')` with no `.catch`. Sheets: `Setup`, `Design Matrix`, and `<first 25 chars of name> Analysis` per response (`:347`, UI-8). Effect Tests hard-code Nparm/DF = 1 (`:298-299`, STAT-17). |
| HTML report | `ProjectView.tsx:355-364` → `htmlExport.ts:6` | Starts in English | `generateExportHTML(project)` gets no locale, so `initialLocale` defaults to `'en'`; the report has its own language select (`htmlExport.ts:93`, `:412`). Embeds the project and per-response analysis JSON (`:318-319`), a 197 kB base64 logo (`logoBase64.ts`), its own en/zh table (`:321-408`) and ~1,150 lines of report script (`:317-1474`). Names are not HTML-escaped (`:52`, `:83-84`, UI-11). |
| Plot PNGs | `ProjectAnalysis.tsx:119-165`, `CompareResponses.tsx:331-371`, `ResidualsPlots.tsx:9-41`, `:82-115` | English file names | `html-to-image` `toPng`; failure → English `alert` (`ProjectAnalysis.tsx:159`) |
| Optimisation report | `ProjectOptimization.tsx:518-592`, saved at `:636` | English only | Markdown stored in `project.optimizationResults`; LaTeX clean-up regexes at `:666-678` (UI-30) |
| Run matrix (Excel import) | `ProjectDesign.tsx:200-444` | Status text English | Static `import { read, utils } from 'xlsx'` (`:7`); replaces all runs (`:404-408`, UI-2, UI-12) |
| SOP steps | `GuideView.tsx:225-262` | Toasts English | JSON download/upload of `SopStep[]` |

## 9. i18n: mechanism and real state

**Mechanism.** `useTranslation()` (`src/web/i18n/LanguageContext.tsx:62-68`) returns `{locale, setLocale, t, supportedLanguages, currentLanguage}`. `t(key, default?, params?)` looks up the current locale, then English, then `default`, then the key (`:40-53`). The chain uses `||`, so an empty translation falls through (I18N-6). No caller passes `params`.

The locale comes from `localStorage.app_language`, which accepts `en|zh|de|es|fr|it` (`:16-19`); otherwise it is `zh` when `navigator.language` starts with `zh`, else `en` (`:21-24`). The provider also sets `<html lang>` (`:32-36`).

`src/web/i18n/translations.ts` holds flat snake_case keys: 187 in `en` (`:17-224`) and the same 187 in `zh` (`:226-433`). `de`/`es`/`fr`/`it` are empty stubs (`:436-439`), and the menu offers only en and zh (`:11-14`).

**Real state (measured with a regex scan of `src/web`).**

- 69 `t()` calls use 54 distinct keys, in 6 files: Dashboard 30, ProjectView 16, Layout 14, ProjectSetup 6, LanguageSelector 2, GuideView 1. **133 of the 187 keys are unused.** Some describe features that do not exist, such as `toggle_exclude` / `status_excluded` (`:151`, `:147`; run exclusion is not implemented) and `discrete` (`:116`). Others would fix registered issues: `delete_confirm_msg` (`:83`) and `reset_sample_confirm` (`:87`) are never shown (UI-1, UI-20).
- **532 inline `locale === 'zh' ? … : …` branches in 12 components**, plus 1 in `LanguageContext` for `<html lang>`. Occurrence counts: ProjectAnalysis 193, ProjectDesign 80, RobustnessSimulation 48, ProjectSetup 41, GuideView 34, McpModal 34, CompareResponses 25, ProjectOptimization 25, ResidualsPlots 17, Dashboard 13, PredictionProfiler 11, TwoLevelDesignSelector 11. The per-file figures in I18N-1 are line counts, so they are lower.
- The HTML export has **54 more `currentLang === 'zh'` branches** in its report script, a separate dictionary (`htmlExport.ts:321-408`) and an en/zh design-name map (`:32-40`). `ProjectOptimization` adds `descZh` literals (`:823-842`). In total there are about 600 inline branches: a grep finds 599 `=== 'zh'` comparisons in `src/web`. Some other counts (~640) included lines or object literals.
- Nine components destructure `t` and never call it: PredictionProfiler, ProjectAnalysis, CompareResponses, ProjectDesign, TwoLevelDesignSelector, McpModal, ProjectOptimization, RobustnessSimulation, ResidualsPlots (twice). Confirmed with `tsc --noUnusedLocals`.
- **English-only output:** the Excel export, the optimisation report, the HTML report's initial language and date (`htmlExport.ts:43-45`), and PNG file names. In the UI itself: 31 `title="…"` attributes, toasts in GuideView, the error at `RobustnessSimulation.tsx:107`, `ProjectOptimization.tsx:618`, the Excel import status, the `PlotlyErrorBoundary` text and the image-download `alert`s (I18N-2, I18N-4).

**Rule for new UI text until I18N-1 lands:** add a key to both `en` and `zh` in `translations.ts` and call `t()`. Do not add new `locale === 'zh'` branches.

## 10. Known issues

UI and I18N issues from the registry. Full text, evidence and fixes are in the [backlog](../../spec/DOE-Magic/roadmap-backlog.md).

| ID | Sev. | Issue | Main location |
|---|---|---|---|
| UI-1 | Critical | "Demo Studies" / "Load Demo Experiments" wipe every project and folder for all users, without confirmation | `Dashboard.tsx:181`, `:343`; `ProjectContext.tsx:269-281` |
| UI-2 | Critical | Generate Design Matrix, Excel import and Simulate Sample Data overwrite measured results without confirmation | `ProjectDesign.tsx:1188`, `:990`, `:404`; `ProjectAnalysis.tsx:189-235` |
| UI-3 | Critical | Profiler fits non-active responses without their saved excluded terms | `ProjectAnalysis.tsx:262`, `:2514` |
| UI-4 | Critical | HTML export surfaces use intercept + numeric main effects only | `htmlExport.ts:1287-1311` |
| UI-5 | High | Three desirability formulas disagree | `PredictionProfiler.tsx:13-40` |
| UI-6 | High | Interaction means computed three ways; centre points counted as "Low" | `ProjectAnalysis.tsx:342-371` |
| UI-7 | High | Main-effects level matching double-counts numeric-looking labels | `ProjectAnalysis.tsx:2035`, `:2047` |
| UI-8 | High | Excel export fails silently for long names or names with `[]:*?/\` | `ProjectView.tsx:347-348`, `:55` |
| UI-9 | High | Robustness uses nominal 0 / SD 0 for factors added later; opening the tab writes the project | `RobustnessSimulation.tsx:22-47`, `:79-101` |
| UI-10 | High | Bayesian optimiser turns a target of 0 into 70 | `ProjectOptimization.tsx:605`, `:631` |
| UI-11 | High | HTML export does not escape names (stored XSS) | `htmlExport.ts:52`, `:83-84` |
| UI-12 | High | Excel import accepts invalid values (blank → 0, missing column → `f.min`, unknown levels) | `ProjectDesign.tsx:346-366` |
| UI-13 | High | Residual PNG download uses fixed DOM ids, so Compare saves response 1 | `ResidualsPlots.tsx:10`, `:50`, `:83`, `:123` |
| UI-14 | High | Resolution table promises a resolution; runs come from a D-optimal subset | `TwoLevelDesignSelector.tsx`; `ProjectDesign.tsx:921-940` |
| UI-15 | Medium | Forked design generator in ProjectDesign | `ProjectDesign.tsx:451-991` |
| UI-16 | Medium | Whole Bayesian optimiser inside the component; unseeded | `ProjectOptimization.tsx:23-593` |
| UI-17 | Medium | Diagnostics rule engine embedded with inline bilingual text | `ProjectAnalysis.tsx:584-1053` |
| UI-18 | Medium | Surface grid ×3; categoricals held at a fractional index | `ProjectAnalysis.tsx:397-582` |
| UI-19 | Medium | Analysis/Compare duplicate tooltip, PNG download, tables and effects plot | §6 |
| UI-20 | Medium | Other destructive actions unconfirmed; playground defaults target the demo project | `Layout.tsx:49-51`; `Dashboard.tsx:270`; `McpModal.tsx:78-113` |
| UI-21 | Medium | HTML report needs CDNs; Plotly 2.27.0 vs app 3.7.0 | `htmlExport.ts:53-54` |
| UI-22 | Medium | `crypto.randomUUID` / `navigator.clipboard` break over plain HTTP on a LAN | `ProjectOptimization.tsx:651`; `McpModal.tsx:46` |
| UI-23 | Medium | No app-level error boundary; a project without `description` crashes search | `App.tsx:15-31`; `Dashboard.tsx:50` |
| UI-24 | Medium | DOE mean plot labels runs by filtered position | `ProjectAnalysis.tsx:386-394`; `CompareResponses.tsx:155-157` |
| UI-25 | Medium | Tab not in URL; tab components lack `key={project.id}` | `ProjectView.tsx:21`, `:485-490` |
| UI-26 | Medium | Guide "launch module" ignores its target, opens `projects[0]` | `GuideView.tsx:78`, `:265-271` |
| UI-27 | Medium | Setup accepts min ≥ max; target input mangles `-` and `1.` | `ProjectSetup.tsx:450-455` |
| UI-28 | Low | Dead code (unused imports/vars, `loadDemoProject`, `socket`, `loading`) | `tsc --noUnusedLocals` |
| UI-29 | Low | Stale memo deps; active response fitted twice | `ProjectAnalysis.tsx:257-383` |
| UI-30 | Low | Gemini-era LaTeX clean-up regexes | `ProjectOptimization.tsx:666-678` |
| UI-31 | High | HTML report's "Model p-value" card prints `analysis.p`, which is the model DF (`p_model = rank − 1`, 14 on the demo project), not a p-value. Same root cause as MCP-1; fixed with it (backlog P0.5) | `htmlExport.ts:27`, `:736`, `:750`; `analysisCore.ts:468`, `:1164`, `:890` |
| UI-32 | Medium | Analysis refits every response on every render when the active response has no saved `excludedTerms` (a new `[]` each render is a memo dependency) | `ProjectAnalysis.tsx:180`, `:271`, `:281` |
| UI-33 | Low | Dead comparison of `location.pathname` with `` `/?folder=${id}` ``; the `location.search` check on the same line does the work | `Layout.tsx:99` |
| I18N-1 | Medium | ~600 inline locale branches bypass `t()`; 9 components never call `t` | §9 |
| I18N-2 | Medium | Exports English-only; HTML export ignores UI locale | `ProjectView.tsx:356` |
| I18N-3 | Medium | Parallel dictionaries (export I18N, design-type names ×3) | `htmlExport.ts:32-40`, `:321-408` |
| I18N-4 | Medium | English-only help, errors, toasts, titles | §9 |
| I18N-5 | Low | 133 of 187 keys unused | `translations.ts` |
| I18N-6 | Low | Empty de/es/fr/it locales, logical-OR fall-through for empty strings, version string in dictionary | `translations.ts:1`, `:20`, `:436-439` |

Other registry IDs that show up in the UI: DATA-1 (= UI-1), DES-1 (Generate), STAT-7 (= UI-3), STAT-8 (= UI-4), STAT-10 (= UI-10), STAT-16, STAT-17, STAT-18, STAT-19, STAT-23, DES-2, DES-11 (D-optimal freezes the tab), DES-13, DES-15, DES-19 (centre runs on all-categorical designs), DES-20 (augmentation with `levels: []`), DATA-4/-5/-8 (write path), DATA-6, DATA-10, DATA-15, DATA-17, DATA-18, DATA-19, DATA-20, DATA-21 (live sync gives up after 3 reconnects), DATA-22 (Setup writes categorical `min`/`max` as 0 and L−1), DATA-23 (Excel import matches columns by name), SRV-4, SRV-12, BLD-6 (payload), BLD-8 (version strings), BLD-11 (`Remix …` title, `axiom_` key).

### Findings from this review, now registered

1. **UI-31: the HTML report's "Model p-value" card shows the model degrees of freedom.** `htmlExport.ts:27` exports `p: res.p`, and `:736`/`:750` print it under the label "Model p-value" / 模型显著性 p 值. `res.p` is `p_model = rank - 1`, a parameter count (`src/core/analysis/analysisCore.ts:468`, `:1164`). It has the same root cause as MCP-1, and STAT-22 (no model p-value exists). Confirmed by reading.
2. **UI-32: Analysis refits every response on every re-render** when the active response has no saved `excludedTerms`. `ProjectAnalysis.tsx:180` creates a new `[]` on each render, and that array is a dependency of both fitting memos (`:271`, `:281`). Any Analysis state change (plot type, table tab, axis select) therefore reruns `computeAnalysis` for all responses. The demo project has no `excludedTerms`. This is a performance problem, related to UI-29. Confirmed by reading.
3. **UI-33:** `Layout.tsx:99` compares `location.pathname` with `'/?folder=…'`, which can never match because the pathname has no query. The highlight still works through the `location.search` check on the same line. Dead comparison.

## 11. Working in `src/web` (for agents)

- Run `npm run check` after any change. It enforces R5 (no `src/server` imports) and R6 (no cross-feature imports). Code used by two features goes to `src/web/shared/` (UI) or `src/core/` (logic).
- Keep each PR either move-only or logic-only. Moving the logic in §5 changes behaviour in some cases (§6 divergences), so pick one copy explicitly and add tests first.
- New UI text goes through `t()` with keys in both `en` and `zh`.
- Features receive `project` and a save callback as props. Do not call `useProjects()` inside `src/web/features/`. Every call to the save callback writes the whole project to the server, so do not call it from effects that run on mount.
