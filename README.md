# DOE Magic (v1.0.0)

DOE Magic is a Design of Experiments (DOE) software for process development. You plan an experiment, enter results, analyse them with validated statistical models, compare responses, optimise across multiple objectives, test robustness with Monte Carlo simulation, and export audit-ready reports. AI assistants can perform the full workflow through the built-in MCP (Model Context Protocol) server.

## Key Features

- **Comprehensive Design Generation**: 2-level full and fractional factorials ($2^{k-p}$ with minimum aberration and design resolution), Definitive Screening Designs (DSD), Central Composite (CCD), Box-Behnken (BBD), Plackett-Burman (PB), and custom D-Optimal designs with replicate center points and reproducible random seeds.
- **Validated Statistical Analysis & ANOVA**: Type III Partial Sum of Squares via two-pass Gram-Schmidt QR decomposition, Lenth's PSE method for saturated screening designs, Lack of Fit test with pure error separation, and Max $R^2$ ($1 - SS_{\text{pure}} / SST$) diagnostic.
- **Interactive Profiler & Diagnostics**: Pareto chart of effects with Bonferroni limits, Half-Normal probability plots, interactive Prediction Profiler with real-time sliders, 2D contour plots, 3D response surface wireframes, Studentized residuals, and Box-Cox power transformations.
- **Multi-Objective Desirability Optimization**: Simultaneous optimization across multiple responses using Derringer–Suich desirability functions (maximize, minimize, target) powered by Nelder-Mead simplex search across continuous, discrete, and categorical factors.
- **Monte Carlo Robustness Simulation**: Process capability and defect rate ($C_{pk}$, % out of specification) estimation under parameter uncertainty and setpoint fluctuations.
- **Model Context Protocol (MCP) Server**: Built-in MCP server (stdio and HTTP endpoints) enabling external AI agents to generate designs, inspect matrices, run regression analyses, and optimize parameters programmatically.
- **Interoperability & Reporting**: Standalone interactive HTML report export with embedded vector SVG surface contours, Excel import/export, complete JSON project backup, bilingual support (English / 简体中文), and custom organization branding logo customization.

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



### Installation

Either install latest version release (.exe)

or

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (Port 3000)
npm run dev

# 3. Type-check & lint
npm run lint

# 4. Production build
npm run build
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development on port 3000. To use another port, set the `PORT` environment variable; the page then no longer reloads by itself after code edits |
| `npm run build` | Build the production bundle into `dist/` |
| `npm start` | Run the production bundle. It needs `NODE_ENV=production`. In PowerShell, run `$env:NODE_ENV="production"; npm start` and close that window afterwards. In bash, run `NODE_ENV=production npm start` |
| `npm run mcp` | Start the MCP server over stdio, for desktop AI clients |
| `npm test` | Run the automated test suite (194 tests across 14 suites). Validates the statistical engine, design generators, MCP tools, and model invariants against textbook reference datasets |
| `npm run check` | Type-check everything (`tsc --noEmit`) and verify layer boundaries and project folder rules (`scripts/check-boundaries.mjs`) |


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


## License

GNU General Public License (GPL-3.0; https://www.gnu.org/licenses/gpl-3.0.html)
