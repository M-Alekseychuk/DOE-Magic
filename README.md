# DOE Magic (v1.0.0)

DOE Magic is a Design of Experiments (DOE) workbench for pharmaceutical process development and open chemistry research (Open Process Chemistry Project — OPCP). You plan an experiment, enter results, analyse them with validated statistical models, compare responses, optimise across multiple objectives, test robustness with Monte Carlo simulation, and export audit-ready reports. AI assistants can perform the full workflow through the built-in MCP (Model Context Protocol) server.

> [!WARNING]
> **If you edit this project in Google AI Studio:** AI Studio pushes its *whole* workspace to GitHub and overwrites what is there.
> 1. **Never push from an AI Studio workspace that is older than `main`.** After every merge, re-import the project from the `main` branch, or start a fresh AI Studio project from it, before you edit there again.
> 2. **Before you switch workspaces:** in your current AI Studio app, open every real project and click **Export JSON** on its page. Keep the files. A new AI Studio project starts with only the demo project. The copy in your browser is not a backup (see [where your data is](#where-your-data-is)). In the new workspace, bring each project back with **Import Project** on the Dashboard.
>
> Nobody has confirmed the exact AI Studio steps yet ([details](docs/context/DOE-Magic/ai-studio-origin.md)). If you are unsure, do not push; ask a developer to do it with you. After any AI Studio push, open the commit on GitHub. If it deletes files you did not mean to delete (`README.md`, `docs/`, anything else), or adds many files at the top level, say so right away; it can be undone.

> [!NOTE]
> **Statistical Engine Validation:** The core mathematics engine has undergone systematic verification against textbook reference cases (Montgomery, Box & Behnken, Jones & Nachtsheim) and Python `statsmodels`:
> 1. **Response Surface Methodology (RSM)**: Full quadratic models ($x_i^2$) are fitted for Central Composite (CCD), Box-Behnken (BBD), and D-optimal designs, correctly capturing surface curvature.
> 2. **Definitive Screening Designs (DSD)**: Built via standard conference-matrix construction with orthogonal main effects and center runs.
> 3. **Fractional Factorials**: Minimum-aberration word generators are computed with exact design resolutions (III, IV, V+).
> 4. **Screening Inference**: Saturated and unreplicated designs employ Lenth’s PSE method for term significance and Pareto limits.
> 5. **Multi-Factor Optimization**: Desirability-based Nelder-Mead simplex optimization searches the full factor space without grid truncation.
> 6. **Model Diagnostics & Reporting**: Includes whole-model ANOVA $F$-test $p$-values, Max $R^2$ ($1 - SS_{\text{pure}} / SST$) Lack of Fit ceiling, and vector SVG response surface contour maps in exports.
>
> All 194 automated tests in the test suite (`npm test`) pass without warnings or expected failures.

> [!IMPORTANT]
> **Data Overwrite Safeguards:**
> - **Generate Design Matrix** checks for recorded response measurements and prompts for confirmation before regenerating any design (MCP tool requires `force: true`).
> - **Simulate Sample Data** only populates empty or unmeasured cells, preserving all existing experimental data.
> - **Demo Studies** on the Dashboard adds a fresh copy of the demo study without touching your existing projects.
> - **Reset Sample Data** in the Archive view requires confirmation and automatically archives a timestamped backup of `data.json` before resetting.
>
> The app runs locally with direct JSON file persistence and has no user authentication. Anyone with network access to the port can read or edit experiments.

## How to run it on your computer

You need [Node.js](https://nodejs.org/) 22.12 or newer (20.19 or newer also works). Older versions cannot run the production build.

Get the code first. On Windows, use a short folder such as `C:\dm\DOE-Magic`, because long paths break the install:

```bash
git clone -c core.longpaths=true https://github.com/M-Alekseychuk/DOE-Magic.git C:\dm\DOE-Magic
```

Then, inside that folder:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The same process serves the web app, the data API and the MCP endpoints. If `npm install` fails with a path or "spawn" error, move the folder somewhere shorter ([why](docs/memory/DOE-Magic/windows-long-paths.md)).

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development on port 3000. To use another port, set the `PORT` environment variable; the page then no longer reloads by itself after code edits |
| `npm run build` | Build the production bundle into `dist/` |
| `npm start` | Run the production bundle. It needs `NODE_ENV=production`. In PowerShell, run `$env:NODE_ENV="production"; npm start` and close that window afterwards. In bash, run `NODE_ENV=production npm start` |
| `npm run mcp` | Start the MCP server over stdio, for desktop AI clients |
| `npm test` | Run the automated test suite (194 tests across 14 suites). Validates the statistical engine, design generators, MCP tools, and model invariants against textbook reference datasets |
| `npm run check` | Type-check everything (`tsc --noEmit`) and verify layer boundaries and project folder rules (`scripts/check-boundaries.mjs`) |

### Where your data is

Your projects are stored on the server in `data.json`, in the folder the server was started from. With the commands above, that is the project folder. The browser keeps only a temporary copy, and the server overwrites it every time the page loads, so it is not a backup. `data.json` is not part of git. When it is missing, the server recreates it with only the demo project.

To back up, click **Export JSON** on each project, or copy `data.json` while the server is stopped.

A confirmed **Reset Sample Data** first copies `data.json` to `data.json.before-reset-<date and time>` in the same folder. To undo a reset, stop the server, copy that file over `data.json`, and start the server again.

## Where things are

The tab names below are the ones the English interface shows.

| You are looking for… | Screen code | Calculation code |
|---|---|---|
| Project list, search, JSON import, archive | `src/web/pages/Dashboard.tsx` | |
| Sidebar: folders, language, dark mode, MCP button, logo branding | `src/web/Layout.tsx` | `src/web/shared/BrandingModal.tsx` |
| A project's page, its tabs, and the Export JSON, Excel and HTML buttons | `src/web/pages/ProjectView.tsx` | |
| **Setup** tab (factors and responses) | `src/web/features/setup/` | `src/core/types.ts` (data model) |
| **Experiment Matrix** tab (design choice, run table, data entry) | `src/web/features/design/` | `src/core/design/` (generators, DSD, D-optimal, fractions) |
| **Model Analysis** tab (model, ANOVA, Lack of Fit, plots, profiler) | `src/web/features/analysis/` | `src/core/analysis/analysisCore.ts`, `modelSpec.ts` |
| **Compare Responses** tab | `src/web/features/compare/` | `src/core/analysis/projectModels.ts` |
| **Robustness & Simulation** tab (Monte Carlo) | `src/web/features/robustness/` | `src/web/features/robustness/` |
| **Bayesian Optimization** tab (desirability & next runs) | `src/web/features/optimization/` | `src/core/optimization/optimize.ts` |
| HTML report export (with SVG contours & branding) | `src/web/features/export/` | `src/core/analysis/surfaceGrid.ts` |
| Guide / SOP page | `src/web/pages/GuideView.tsx` | |
| MCP panel (sidebar button) | `src/web/features/mcp-panel/` | `src/server/mcp/doeMcpServer.ts` |
| Organization branding & logo customization | `src/web/shared/BrandingModal.tsx` | `src/web/state/BrandingContext.tsx` |
| Language switch and translations (English / 简体中文) | `src/web/i18n/` | |
| Saving and loading projects | `src/web/state/ProjectContext.tsx` | `server.ts` |

## Project layout

```text
server.ts          the server: web app, data API, live sync, MCP over HTTP
index.html         the web page that loads the app (src/main.tsx)
src/
  main.tsx         starts the web app
  core/            pure TypeScript statistics, design, optimization, and data model (runs in browser and server)
    analysis/      OLS, ANOVA, Lenth PSE, surface grids, Lack of Fit, QR solver
    design/        factorial, DSD, CCD, BBD, Plackett-Burman, D-optimal, center points, randomization
    optimization/  Nelder-Mead desirability optimization and candidate generators
  server/          Node-only code: MCP server (HTTP and stdio endpoints)
  web/             the web app: screens, tabs, translations, shared widgets, branding
public/            static files served as-is (OPCP logo, Plotly charting library)
scripts/           project tools (the folder-rule and layer boundary check)
tests/             vitest test suite and textbook reference fixtures
docs/              project documentation (see below)
```

`server.ts`, `index.html`, `vite.config.ts`, `metadata.json` and `src/main.tsx` stay where they are, because Google AI Studio expects them there. `npm run check` fails if code is put in the wrong place. The rules are in the [design spec](docs/spec/DOE-Magic/design-spec.md).

**If you edit in AI Studio,** paste this at the start of each AI Studio chat:

> Do not create new files in the project's top folder. Do not write patch, fix or debug scripts; edit the source files directly. Put calculations in src/core, screens in src/web/features/<tab>. Do not move server.ts, index.html, vite.config.ts or src/main.tsx.

## Documentation

Start with **[Status and handoff](docs/task/DOE-Magic/status-and-handoff.md)**. It covers the current state, the verified fixes and the next steps.

| Folder | Contents |
|---|---|
| [`docs/task/DOE-Magic/`](docs/task/DOE-Magic/) | [Goals](docs/task/DOE-Magic/goals.md) and the [status and handoff](docs/task/DOE-Magic/status-and-handoff.md) |
| [`docs/spec/DOE-Magic/`](docs/spec/DOE-Magic/) | The [design spec](docs/spec/DOE-Magic/design-spec.md) (architecture rules) and the prioritised [roadmap and backlog](docs/spec/DOE-Magic/roadmap-backlog.md) |
| [`docs/context/DOE-Magic/`](docs/context/DOE-Magic/) | How each part works today, with its known issues |
| [`docs/memory/DOE-Magic/`](docs/memory/DOE-Magic/) | Lessons learned: mistakes not to repeat |

AI coding assistants start from [`AGENTS.md`](AGENTS.md).
