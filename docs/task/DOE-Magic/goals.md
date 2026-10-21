# DOE-Magic — Goals

> Created: 2026-10-20. Status: Phase 0 (foundation) delivered by PR `chore/project-structure-and-core-docs`; Phases 1–4 not started.
> Related: [Status and handoff (START HERE)](status-and-handoff.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md)

## Vision

A DOE workbench for pharmaceutical process development that scientists can trust. It covers the whole loop: plan the experiment, enter the results, analyse them, optimise the process, check how robust it is, and hand a report to colleagues. Scientists use it in the browser. AI agents can do the same work through MCP. Each number shown on screen, in an export or in an MCP reply comes from one tested implementation. Where a quantity cannot be estimated, the app says so instead of printing a number.

## Users

| User | What they need from the app |
|---|---|
| Process scientists at Jiuzhou Pharmaceutical (en/zh) | Choose a design, record results, read the ANOVA and plots, and pick settings. They need numbers that agree with reference software, and warnings when the data cannot support a conclusion. |
| AI agents over MCP | The same operations from code: stdio (`npm run mcp`) or HTTP/SSE (`/mcp`, `/mcp/sse`). They need typed, unambiguous outputs that match the UI. |
| Readers of exports (colleagues, QA) | HTML and Excel reports that show the same model and surfaces as the app. |
| Maintainers | The owner, M-Alekseychuk, owns the GitHub repo, builds and edits the app in Google AI Studio and has no software background. Developers (people or AI coding agents) work through pull requests. All of them need small, documented changes and a check that catches layer mistakes (`npm run check`). |

## Scope

What the app already offers, and what stays in scope:

- **Workflow tabs** ([`src/web/pages/ProjectView.tsx:368-373`](../../../src/web/pages/ProjectView.tsx); English labels from [`src/web/i18n/translations.ts:96-101`](../../../src/web/i18n/translations.ts), which take precedence over the fallbacks in ProjectView): Setup, Experiment Matrix, Model Analysis, Compare Responses, Robustness & Simulation, Bayesian Optimization. There is also a Guide/SOP page, a dashboard with folders, and an MCP panel.
- **Design types** ([`src/core/types.ts:2`](../../../src/core/types.ts)): 2-level factorial (full or fractional), definitive screening (DSD), central composite (CCD), Box-Behnken (BBD), Plackett-Burman, and custom D-optimal.
- **Analysis**: OLS with ANOVA, lack of fit, effects (Pareto, half-normal), parameter estimates, residual diagnostics, Box-Cox, desirability, prediction profiler, and response surfaces.
- **Exports**: JSON (the Dashboard can import it again), Excel, and an HTML report.
- **MCP server** ([`src/server/mcp/doeMcpServer.ts`](../../../src/server/mcp/doeMcpServer.ts)): 11 tools, 3 resources and 2 prompts. Over HTTP/SSE it shares the web server's in-memory store; the stdio server (`npm run mcp`) loads its own copy of `data.json` (DATA-3).
- **Languages**: English and Simplified Chinese. The Chinese UI translates DOE terms and often adds the English term in parentheses (for example "(ANOVA)", "(Pareto Chart)").

## Non-goals (for now)

- **No formal computer-system validation (GxP / 21 CFR Part 11).** Phase 3 only makes the app *ready* for that: audit trail, identity and backups. Whether the tool falls under such rules is unverified (DATA-16).
- **No LLM inside the app.** Gemini was removed ([`server.ts:122`](../../../server.ts)). AI help comes from external agents over MCP.
- **No rewrite and no framework change.** The app is improved step by step in place.
- **No feature parity with JMP or similar tools.** The goal is that the features the app *has* agree with reference software.
- **No new languages** until English and Chinese go through one dictionary (I18N-1, I18N-6).
- **No multi-tenant SaaS.** Phase 3 adds the minimum access control the deployment needs (SRV-1), not user management.

## Guiding principles

1. **Statistical correctness first, and verifiable.** Every statistic has a test that pins its value against JMP, R or a published example. A number without such a test counts as unverified. When something is not estimable (no error degrees of freedom, singular design), report "not estimable". Never report 0, p = 1, or a zero-width interval.
2. **One implementation per calculation, in `src/core`.** The UI, the exports and MCP all call the same function. Today two design generators, three desirability formulas, two Monte Carlo loops and three surface-grid copies have already drifted apart. Never add another copy.
3. **No silent data loss.** Destructive actions ask first. Imports validate before they write. Writes can be recovered.
4. **Keep Google AI Studio workable.** Root files stay where AI Studio expects them, and the port stays 3000. After each merge, the AI Studio project is re-imported from `main`, with every real project exported as JSON first and brought back with Import Project (see [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md)).
5. **Minimal ceremony.**
   - Small PRs, each either move-only or a logic change, never both.
   - `npm run check` and `npm run build` must pass.
   - Docs change in the same PR as the behaviour they describe.
   - Process is limited to tests and CI.
6. **Say what the model can't support.** Warn about extrapolation, missing or unparseable data, aliasing and untestable lack of fit.

## Phased roadmap

The issue IDs below anchor each phase. The [backlog](../../spec/DOE-Magic/roadmap-backlog.md) assigns every issue to a phase and gives the order of PRs.

### Phase 0: Foundation (this PR)

**Work:**
- Remove the dead root scripts.
- Stop tracking `data.json`.
- Sync `package-lock.json`.
- Split `src/` into `core/`, `server/` and `web/`.
- Limit Tailwind scanning to `src/`.
- Add `npm run check` (rules R1–R9: the layer rules plus a repo-root allowlist) and ignore `.aistudio/`.
- Write the README, the agent index and this doc set.

There are no behaviour changes.

**Success criteria:**
- `npm run check` passes.
- `npm run build` succeeds, and the JS bundle is the same size as before.
- A behavioural smoke snapshot matches the one taken before the change.
- Every Critical issue is written down with evidence.
- The AI Studio project is re-imported from `main` after merge, and the real projects are brought back from their exported JSON files.

### Phase 1: Statistical correctness, with tests

**Work:**
- Add a test runner and CI (BLD-4).
- Fix the Critical calculation and design issues, one PR per issue, each with a reference test:
  - STAT-1: rank-deficient (X'X)⁻¹
  - STAT-2: Lenth scaling
  - STAT-3: quadratic terms (together with DES-4)
  - STAT-4: optimum search
  - DES-2: regular fractions
  - DES-3: real DSDs
  - MCP-1 (with UI-31, the HTML report's "Model p-value") and MCP-2
  - UI-3 and UI-4
- Fix the High issues that make results wrong:
  - STAT-5, STAT-10/UI-10, STAT-11, STAT-12
  - MCP-6 to MCP-9
  - DES-5/MCP-13, DES-6 (with DES-19 to DES-21), DES-7

The one-click data-loss issues (DATA-1/UI-1, DES-1/UI-2, MCP-10) are small guard fixes. Do them at the start of this phase rather than waiting for Phase 3.

**Success criteria:**
- CI runs `npm ci`, `npm run check`, the tests and `npm run build` on every PR.
- Each core statistic has at least one reference test, for example:
  - the sum of leverages equals the rank on a Plackett-Burman design with centre points
  - the Lenth (1989) example is reproduced
  - lack of fit matches a reference
- CCD and BBD data are fitted with squared terms, and a known quadratic surface gives its interior optimum.
- Generated fractions have the resolution the selector shows (checked from the alias structure). DSD main-effect columns are orthogonal.
- MCP `run_analysis` and the HTML report return a real model p-value, and `run_analysis` does not crash on saturated designs.
- No Critical issue is open in the registry.

### Phase 2: Consolidation

**Work:** make each calculation exist once, in `src/core`, with typed results.

| Calculation | Issues |
|---|---|
| Design generator | DES-8/UI-15/MCP-19 |
| Desirability and optimum search | STAT-6/MCP-3/UI-5, MCP-11 |
| Monte Carlo | STAT-9/MCP-16/UI-9 |
| Effect plots and surface grids | STAT-16/UI-6/UI-7/UI-18 |
| Bayesian optimizer | UI-16/STAT-13 |
| Diagnostics rules | UI-17 |

Then:
- Replace the hand-written MCP dispatcher with the SDK transport (MCP-5, MCP-17, MCP-22).
- Split `server.ts` and share one store with the stdio MCP (SRV-5, MCP-20).
- Make TypeScript strict, starting with `src/core` (BLD-9).

**Success criteria:**
- Golden-output tests show that the UI path and the MCP path give the same numbers for the same project: designs, analysis, optimum and robustness.
- Feature components only render. They hold no statistics.
- `src/core` compiles under `strict`.
- The UI playground and `/api/mcp/info` no longer read private SDK fields.

### Phase 3: Data integrity, security and compliance readiness

**Work:**
- Atomic writes and backups, and no reseeding over a corrupt file (DATA-2, SRV-13).
- One owner of `data.json` (DATA-3).
- Revision checks on writes (DATA-4, DATA-8).
- Visible save failures, and live sync that recovers after an outage (DATA-5, DATA-21).
- Schema validation at every entry point, a root error boundary, and validated run-sheet import and number entry (DATA-6, DATA-7, DATA-10, UI-23, DES-13), including one categorical `min`/`max` convention, unique names and at least two levels per categorical factor (DATA-22, DATA-23, STAT-27).
- Confirmation for every remaining destructive action (DATA-17, UI-20).
- Cascading edits (DATA-11).
- A schema version and migrations (DATA-12).
- Access control: restricted CORS, localhost binding by default, and a token (SRV-1).
- No source maps served (SRV-2/BLD-2).
- A correct production start (SRV-3/BLD-1).
- One lockfile and a declared Node version (BLD-7, SRV-6/BLD-13), once open decision 1 is made.
- Exact-id lookups for destructive MCP tools (MCP-4).
- Escaping in the HTML export (UI-11).
- A dependency audit (BLD-3).
- A persisted change log (DATA-16, MCP-21).
- A durable store for any hosted deployment (DATA-9).

**Success criteria:**
- Killing the server mid-write loses no data.
- A stale tab or an MCP write cannot silently overwrite newer data.
- Malformed payloads get a 400 response and are not stored.
- Every destructive action asks for confirmation.
- Another website or a LAN host without the token cannot read or change data.
- Every change records who made it, what changed, when, and whether it came from the UI or MCP.
- `npm audit --omit=dev` reports no high or critical advisories on runtime paths.

### Phase 4: UX and i18n polish

**Work:**
- All user-visible text goes through `t()` (I18N-1 to I18N-6), and exports follow the UI language.
- Excel export fixes (UI-8, STAT-17).
- Plot download fixes (UI-13).
- Routed tabs (UI-25, UI-26).
- An offline-capable report (UI-21).
- Smaller payload (BLD-6).
- Remove unused dependencies (BLD-5).
- A single version source (BLD-8).
- Branding clean-up (BLD-11).
- The remaining Medium and Low UI items.

**Success criteria:**
- No `locale === 'zh'` ternaries remain, and a check script rejects new ones.
- Excel, HTML and the optimisation report open in the user's language.
- The first page load no longer blocks on the 4.9 MB Plotly script.
- One version string appears everywhere.
