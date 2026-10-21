# DOE Magic

DOE Magic is a Design of Experiments (DOE) workbench for pharmaceutical process development, built for Jiuzhou Pharmaceutical. You plan an experiment, enter results, analyse them, compare responses, optimise and test robustness, then export a report. AI assistants can do the same through the app's built-in MCP (Model Context Protocol) server.

> [!WARNING]
> **If you edit this project in Google AI Studio.** AI Studio pushes its *whole* workspace to GitHub and overwrites what is there.
> 1. **Never push from an AI Studio workspace that is older than `main`.** The restructuring pull request (#1) was merged on 2026-10-21. After that and after every later merge, re-import the project from the `main` branch, or start a fresh AI Studio project from it, before you edit there again.
> 2. **Before you switch workspaces:** in your current AI Studio app, open every real project and click **Export JSON** on its page. Keep the files. A new AI Studio project starts with only the demo project. The copy in your browser is not a backup (see [where your data is](#where-your-data-is)). In the new workspace, bring each project back with **Import Project** on the Dashboard.
>
> Nobody has confirmed the exact AI Studio steps yet ([details](docs/context/DOE-Magic/ai-studio-origin.md)). If you are unsure, do not push; ask a developer to do it with you. After any AI Studio push, open the commit on GitHub. If it deletes files you did not mean to delete (`README.md`, `docs/`, anything else), or adds many files at the top level, say so right away; it can be undone. The first push after the merge (commit cc41f15) deleted the two lockfiles and `assets/.aistudio/.gitignore` without saying so. The lockfiles are no longer kept, so that part needs nothing from you.

> [!CAUTION]
> **Some results are known to be wrong.** Do not use these for process decisions, batch records or reports until they are fixed:
> 1. Anything from Central Composite (CCD), Box-Behnken or "DSD" designs: surfaces, profiler, optimum and robustness. Squared terms are never fitted, so curvature is ignored.
> 2. "DSD" designs themselves. Their main effects are correlated.
> 3. The resolution shown for fractional factorials.
> 4. p-values and significance on screening designs.
> 5. "Optimal conditions" with 6 or more factors.
> 6. The "Model p-value" in the HTML report, and the response-surface plots in exported reports.
>
> The full list is in [Status and handoff](docs/task/DOE-Magic/status-and-handoff.md#top-risks-right-now).

> [!CAUTION]
> **Buttons that delete data without asking:**
> - **Demo Studies** and **Load Demo Experiments** on the Dashboard replace *all* projects for everyone. Demo Studies sits right next to **Import Project**, so take care.
> - **Generate Design Matrix**, Excel import and **Simulate Sample Data** overwrite measured results.
>
> Before using any of them, click **Export JSON** on each project's page. **Import Project** on the Dashboard brings the file back as a copy.
>
> The app has no login. Anyone who can open its address can read and delete everything, including anyone with the link if it was shared or deployed from AI Studio.

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
| `npm start` | Run the production bundle. It needs `NODE_ENV=production`. In PowerShell, run `$env:NODE_ENV="production"; npm start` and close that window afterwards, otherwise a later `npm run dev` in it serves the old build. In bash, run `NODE_ENV=production npm start` |
| `npm run mcp` | Start the MCP server over stdio, for desktop AI clients |
| `npm run check` | Type-check everything and verify the folder rules. Developers run it before every commit. AI Studio cannot run it, so until automatic checks exist, someone with a local copy runs it after each AI Studio push |

### Where your data is

Your projects are stored on the server in `data.json`, in the folder the server was started from. With the commands above, that is the project folder. The browser keeps only a temporary copy, and the server overwrites it every time the page loads, so it is not a backup. `data.json` is not part of git. When it is missing, the server recreates it with only the demo project.

To back up, click **Export JSON** on each project, or copy `data.json` while the server is stopped.

## Where things are

The tab names below are the ones the English interface shows.

| You are looking for… | Screen code | Calculation code |
|---|---|---|
| Project list, search, JSON import, archive | `src/web/pages/Dashboard.tsx` | |
| Sidebar: folders (create and delete), language, dark mode, MCP button | `src/web/Layout.tsx` | |
| A project's page, its tabs, and the Export JSON, Excel and HTML buttons | `src/web/pages/ProjectView.tsx` | |
| **Setup** tab (factors and responses) | `src/web/features/setup/` | `src/core/types.ts` (the data model) |
| **Experiment Matrix** tab (design choice, run table, data entry) | `src/web/features/design/` | `src/core/design/` |
| **Model Analysis** tab (model, ANOVA, plots, profiler) | `src/web/features/analysis/` | `src/core/analysis/analysisCore.ts` |
| **Compare Responses** tab | `src/web/features/compare/` | `src/core/analysis/analysisCore.ts` |
| **Robustness & Simulation** tab (Monte Carlo) | `src/web/features/robustness/` | still inside the component |
| **Bayesian Optimization** tab (suggested next runs) | `src/web/features/optimization/` | still inside the component |
| HTML report export | `src/web/features/export/` | |
| Guide / SOP page | `src/web/pages/GuideView.tsx` | |
| MCP panel (sidebar button) | `src/web/features/mcp-panel/` | `src/server/mcp/doeMcpServer.ts` |
| Language switch and translations | `src/web/i18n/` | |
| Saving and loading projects | `src/web/state/ProjectContext.tsx` | `server.ts` |

## Project layout

```text
server.ts          the server: web app, data API, live sync, MCP over HTTP
index.html         the web page that loads the app (src/main.tsx)
src/
  main.tsx         starts the web app
  core/            calculations and data model; runs in the browser and on the server
  server/          code that only runs on the server (the MCP server)
  web/             the web app: screens, tabs, translations, shared widgets
public/            files served as-is (logo, Plotly charting library)
scripts/           project tools (the folder-rule check)
docs/              project documentation (see below)
```

`server.ts`, `index.html`, `vite.config.ts`, `metadata.json` and `src/main.tsx` stay where they are, because Google AI Studio expects them there. `npm run check` fails if code is put in the wrong place. The rules are in the [design spec](docs/spec/DOE-Magic/design-spec.md).

**If you edit in AI Studio,** paste this at the start of each AI Studio chat:

> Do not create new files in the project's top folder. Do not write patch, fix or debug scripts; edit the source files directly. Put calculations in src/core, screens in src/web/features/<tab>. Do not move server.ts, index.html, vite.config.ts or src/main.tsx.

## Documentation

Start with **[Status and handoff](docs/task/DOE-Magic/status-and-handoff.md)**. It covers the current state, the known risks and the next steps.

| Folder | Contents |
|---|---|
| [`docs/task/DOE-Magic/`](docs/task/DOE-Magic/) | [Goals](docs/task/DOE-Magic/goals.md) and the [status and handoff](docs/task/DOE-Magic/status-and-handoff.md) |
| [`docs/spec/DOE-Magic/`](docs/spec/DOE-Magic/) | The [design spec](docs/spec/DOE-Magic/design-spec.md) (architecture rules) and the prioritised [roadmap and backlog](docs/spec/DOE-Magic/roadmap-backlog.md) |
| [`docs/context/DOE-Magic/`](docs/context/DOE-Magic/) | How each part works today, with its known issues |
| [`docs/memory/DOE-Magic/`](docs/memory/DOE-Magic/) | Lessons learned: mistakes not to repeat |

AI coding assistants start from [`AGENTS.md`](AGENTS.md).
