# DOE-Magic — Lesson: Forked logic drifts apart

> Created: 2026-10-20. Status: open. Consolidation is backlog (DES-8, MCP-19, UI-15, STAT-6, MCP-3, UI-5, STAT-9, MCP-16, MCP-20, STAT-16, UI-18); the rule is in AGENTS.md.
> Related: [Design spec](../../spec/DOE-Magic/design-spec.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design generation](../../context/DOE-Magic/design-generation.md), [Statistics engine](../../context/DOE-Magic/statistics-engine.md), [MCP server](../../context/DOE-Magic/mcp-server.md), [Web UI](../../context/DOE-Magic/web-ui.md), [Server and persistence](../../context/DOE-Magic/server-and-persistence.md)

## Symptom

The same project gives different answers depending on where a calculation runs. Every pair below was compared in the current code:

| Calculation | Copies | How they differ | IDs |
|---|---|---|---|
| Design generation | Core `generateDesign` (`src/core/design/doeGenerator.ts:20`), called only by MCP (`src/server/mcp/doeMcpServer.ts:273`, `:462`). The UI has its own `generateRuns` (`src/web/features/design/ProjectDesign.tsx:451-991`) and never imports the core one | **Two-level categorical check:** `<= 2` (`doeGenerator.ts:38`) vs `=== 2` (`ProjectDesign.tsx:145-147`).<br>**Centre points:** core honours `options.centerPoints`, default 3 (`doeGenerator.ts:89`), for CCD, BBD and DSD (at least 1), PB and full factorials, but adds none for custom D-optimal or fractional subsets (DES-21). The UI adds them only for `factorial_2level` and `custom_d_optimal` (`ProjectDesign.tsx:963-964`), even when every factor is categorical (DES-19), and hard-codes one for CCD, BBD and DSD. MCP turns a stored 0 into 3 when the call omits `centerPoints` (`doeMcpServer.ts:460`).<br>**Run order:** core does not randomise (`runOrder = stdOrder`, `doeGenerator.ts:76-77`). The UI uses a biased `sort(() => Math.random() - 0.5)` (`ProjectDesign.tsx:987-988`) and sets `stdOrder: 0` for CCD, BBD, PB and DSD runs (e.g. `:628`, `:765`, `:805`, `:892`).<br>**D-efficiency:** multiplied by 100 twice, on the MCP path only (`doeGenerator.ts:108`, `doeMcpServer.ts:494`) | DES-8, MCP-19, UI-15, DES-6, DES-19, DES-21, DES-7, MCP-10, MCP-13 |
| Desirability | `src/core/analysis/analysisCore.ts:757-782`; `src/web/features/analysis/PredictionProfiler.tsx:13-40` and `:77-84`; `src/server/mcp/doeMcpServer.ts:832-853` and `:886-895` | **Maximize:** core uses `targetValue` as the upper anchor; the Profiler and MCP ignore it.<br>**Target:** core uses a triangle of half the observed span around the target (default: the mean); the Profiler and MCP run from observed min to max (default: the midpoint).<br>**Combining responses:** the Profiler takes an unweighted geometric mean; MCP weights responses (a weight of 0 becomes 1) and treats d ≤ 1e-4 as zero | STAT-6, MCP-3, UI-5, MCP-12 |
| Monte Carlo robustness | `src/web/features/robustness/RobustnessSimulation.tsx` vs `simulate_robustness` (`src/server/mcp/doeMcpServer.ts:965`) | **Variance divisor:** N (`RobustnessSimulation.tsx:172`, `:224`) vs N−1 (`doeMcpServer.ts:1047`).<br>**Residual noise:** off by default (`RobustnessSimulation.tsx:60`) vs on (`doeMcpServer.ts:978`).<br>**Missing nominal:** 0 (`RobustnessSimulation.tsx:135`, `:210`) vs the midpoint (`doeMcpServer.ts:1015`).<br>**MCP only:** clamps samples to [0.9·min, 1.1·max] (`:1023`) and forces N into 500–25,000 (`:1000`) | STAT-9, MCP-2, MCP-16, UI-9 |
| Store start-up | `server.ts:24-68` vs `src/server/mcp/stdio.ts:8-38` | stdio seeds the samples only when the store is empty (`stdio.ts:21-27`); `server.ts` also re-adds missing samples (`server.ts:37-56`). The legacy-id purge is copied three times (`server.ts:59-60`, `stdio.ts:29-30`, `src/web/state/ProjectContext.tsx:31`) | MCP-20, DATA-12 |
| Interaction-plot means | `src/web/features/analysis/ProjectAnalysis.tsx:343-344`, `src/web/features/compare/CompareResponses.tsx:139-142`, `src/web/features/export/htmlExport.ts:1142`, `:1147` | Centre points count as "low" in Analysis (`<= mid`), are excluded in Compare (±1e-6), and are counted in both lines in the export | STAT-16, UI-6 |
| Surface grids | `ProjectAnalysis.tsx:397-582`, `CompareResponses.tsx:160-319`, `htmlExport.ts:1223-1345` | The export predicts from main effects only (`htmlExport.ts:1287-1311`) | UI-18, STAT-8, UI-4 |

As a result, a scientist can get one "optimal recipe" in the Analysis tab, another in the Profiler and a third from an AI agent over MCP.

## Root cause

- Features were added prompt by prompt. Each new screen or MCP tool got its own copy of a calculation, written next to it, instead of importing an existing function. This is inferred from the code layout: `ProjectDesign.tsx` has never imported `generateDesign`, and the Monte Carlo loop lives inside a React component.
- Nothing tied the copies together: no tests, analysis results typed `any`, and no shared option types.
- Fixes then landed in one copy only. For example, centre points are honoured in core but not in the UI.

## Fix

Not fixed yet. This PR only moved files, and logic changes come in later PRs. The plan has three parts:

- One pure implementation per calculation in `src/core`, called by the UI and by MCP.
- Golden-output tests that pin the intended results before callers are switched over (BLD-4).
- The layer rules leave only one legal place for shared code:
  - R6 bans imports between features.
  - R7 keeps server code to `src/core` and `src/server`.

## Rule

There is one implementation of each calculation, it lives in `src/core`, and the UI and MCP both call it.

**How to apply:**

- Before you write a calculation in a component or an MCP tool, search `src/` for an existing one, for example `grep -rn "desirab" src`.
- If one exists elsewhere, move it to `src/core` and call it from both places. Do the move in its own move-only PR if it is large.
- If two copies already exist, do not fix just one. Consolidate them first, with a test that pins the correct result.
- In review, a PR that adds maths under `src/web` or `src/server/mcp` without a matching `src/core` change needs a stated reason.
