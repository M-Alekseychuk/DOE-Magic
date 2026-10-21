# DOE-Magic — MCP Server

> Created: 2026-10-20. Status: describes the MCP server as it is on branch `chore/project-structure-and-core-docs` (behaviour unchanged by the `src/` restructure); verified against the code and by running it in memory, over SSE and over stdio.
> Related: [Server and persistence](server-and-persistence.md), [Statistics engine](statistics-engine.md), [Design generation](design-generation.md), [Web UI](web-ui.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md)

DOE Magic exposes its projects, design generator and statistics engine to AI clients through the Model Context Protocol (MCP). One module builds the server; two entry points host it:

| Piece | File | Role |
|---|---|---|
| Server factory | [`src/server/mcp/doeMcpServer.ts`](../../../src/server/mcp/doeMcpServer.ts) | `createDoeMcpServer(context)` registers 11 tools, 3 resources and 2 prompts (`:46-1314`). Also exports the activity log (`:17-41`) and the hand-written JSON-RPC dispatcher `handleDirectJsonRpc` (`:1319-1447`). |
| HTTP host | [`server.ts`](../../../server.ts) | Mounts MCP on the Express app at port 3000: SSE, messages, direct JSON-RPC, info, logs (`server.ts:219-363`). |
| stdio host | [`src/server/mcp/stdio.ts`](../../../src/server/mcp/stdio.ts) | `npm run mcp` (`package.json:10`). A separate Node process with its own copy of the store. |

SDK: `@modelcontextprotocol/sdk` 1.32.1 (installed), zod 4. Server info: name `doe-magic-mcp`, version `1.5.2` (hard-coded, `doeMcpServer.ts:49-50`). Everything is registered with the older `server.tool` / `server.resource` / `server.prompt` overloads; no tool declares an `outputSchema` or returns `structuredContent` (MCP-23).

## Tools

Every tool returns `{content: [{type: 'text', text: <JSON string>}]}`. On failure it returns `isError: true` and a text message such as `Error running analysis: <message>`. Every tool call is written to the activity log (see [Activity log](#activity-log)).

Project, response and factor lookups accept an id or a name (`doeMcpServer.ts:62-87`):

- `findProject`: exact id, then exact case-insensitive name, then case-insensitive substring of the name. An empty string matches the first project (MCP-4).
- `resolveResponse`: same three steps.
- `resolveFactorId`: exact id, then exact case-insensitive name. Otherwise it returns the key unchanged, so a misspelt factor is silently ignored (MCP-15).

| # | Tool (lines) | Inputs (zod; defaults apply only on the SDK paths, see MCP-5) | Output JSON | Writes? |
|---|---|---|---|---|
| 1 | `list_projects` (`:94-166`) | `folderId?`, `includeArchived?` (archived hidden unless true) | `{total, projects: [{id, name, description, designType, factorsCount, factors[{name, type, unit, range}], responsesCount, responses[{name, goal, unit, target}], totalRuns, completedRuns, updatedAt (ISO)}]}` | No |
| 2 | `get_project` (`:169-215`) | `projectId` | The full stored `Project` | No |
| 3 | `create_project` (`:218-330`) | `name`; `description?`; `folderId?` (not validated); `factors[] {name, type = numeric, min = 0, max = 100, levels?, unit = ''}`; `responses[] {name, goal = maximize, targetValue?, unit = ''}`; `designType = factorial_2level` (6-value enum); `centerPoints = 3`; `autoGenerateRuns = true` | `{message, project, designSummary}` | Yes: new project. If `autoGenerateRuns` and there is at least one factor, runs come from core `generateDesign` (`:273`). |
| 4 | `update_project` (`:333-391`) | `projectId`, `name?`, `description?`, `folderId?`, `isArchived?`, `designType?` | `{message, project}` | Yes. Changing `designType` does not regenerate runs. |
| 5 | `delete_project` (`:394-440`) | `projectId` | `{message}` | Yes: hard delete. The UI archives first; MCP does not. |
| 6 | `generate_doe_design` (`:443-518`) | `projectId`, `designType?`, `centerPoints?`, `targetRuns?` | `{message, designName, notes, dEfficiency ("x%"), runsCount, sampleRuns (first 5: runOrder, factors)}` | Yes: replaces `project.runs` (measured responses included), sets `designType` and `centerPoints` (`:469-472`). |
| 7 | `add_run_results` (`:521-603`) | `projectId`, `runs[] {runOrder?, runId?, responses: {<response id or name>: number \| null}}` | `{message, totalRuns, completedRuns}` | Yes: `run.responses`. Each input goes to the first stored run whose `id` equals `runId` **or** whose `runOrder` equals `runOrder` (`:543-546`). Unmatched inputs are skipped silently. |
| 8 | `run_analysis` (`:606-703`) | `projectId`, `responseId?` (default: first response), `excludedTerms?` (falls back to the response's saved `excludedTerms`; not persisted) | `{project, response, summary {rSquared, adjRSquared, rmse, fRatio, pValue, runsAnalyzed, adequatePrecision}, lackOfFit {fRatio, pValue, significant, interpretation}, modelTerms[{term, estimate, stdError, tRatio, pValue, significant, vif}], paretoRanking[top 8]}` | No |
| 9 | `predict_response` (`:706-773`) | `projectId`, `responseId?`, `factorSettings: {<factor id or name>: number \| string}` | `{project, response, unit, predictedValue, rmse, rSquared, factorSettingsUsed}` (echoes the input; no CI or PI) | No |
| 10 | `optimize_desirability` (`:776-962`) | `projectId`, `gridPointsPerFactor = 10` (clamped to 5..25, `:799`), `weights?: {<response id or name>: number}` | `{message, bestOperatingRecipe, topCandidates[5] {factors (by name), predicted, individualDesirabilities, overallDesirability}}` | Yes: `optimizationCandidates` (top 5, keyed by factor id) and `optimizationResults` (a one-line string that replaces the UI's Markdown report) (`:916-923`). |
| 11 | `simulate_robustness` (`:965-1132`) | `projectId`, `responseId?`, `nominalSettings`, `factorStdDevs`, `specLimits {lsl?, usl?}`, `numSimulations = 5000` (clamped to 500..25000, `:1000`), `includeResidualNoise = true` | `{project, response, simulations, statistics {mean, standardDeviation, rmseResidualNoiseIncluded}, capability {cpk, assessment, defectRatePercent, defectPPM, passRatePercent}, specificationLimits {lsl, usl, outOfSpecCount, belowLslCount, aboveUslCount}}` | No |

There are no tools to edit factors or responses, persist excluded terms, or manage folders.

Several outputs are wrong today. Do not trust them until the matching issue is fixed:

- `run_analysis`: `summary.pValue` is the model's degrees of freedom (MCP-1). `paretoRanking` has no term names and its magnitude is always 0 (MCP-6). Lack of fit is reported as adequate when it cannot be tested (MCP-8). `excludedTerms` matches ids, not names (MCP-7).
- `generate_doe_design`: `dEfficiency` is 100x too large (MCP-13).

Ran on the demo project: `pValue` 14 next to `fRatio` 261.97, and Pareto entries `{effectMagnitude: 0, tRatio: 38.217}`.

## Resources

| Name | URI | Returns |
|---|---|---|
| `doe-projects-list` (`:1139-1171`) | `doe://projects` (static) | JSON array `[{id, name, description, designType, factorsCount, responsesCount, runsCount}]`. Archived projects are included. |
| `doe-project-detail` (`:1174-1201`) | template `doe://project/{id}` | The full project JSON. `id` goes through `findProject`, so names and substrings work too. |
| `doe-analysis-detail` (`:1204-1233`) | template `doe://analysis/{projectId}/{responseId}` | `JSON.stringify` of the raw `computeAnalysis` result: functions dropped, the field `p` is the model DF (MCP-1), and the whole result is `null` when the response has no data. |

Both templates are registered with `list: undefined`, so `resources/list` never enumerates concrete project URIs.

## Prompts

Prompt arguments are strings.

| Prompt (lines) | Arguments | Produces |
|---|---|---|
| `interpret_doe_results` (`:1239-1278`) | `projectId`, `responseId?` | One user message. It tells the model to call `run_analysis`, then judge R², the model p-value (`p < 0.05`, which MCP-1 corrupts), lack of fit and Pareto significance, and recommend next steps. |
| `recommend_doe_design` (`:1280-1311`) | `factorCount`, `objective`, `experimentalRunBudget?` | One user message asking for a design recommendation and the exact `create_project` / `generate_doe_design` arguments. |

## HTTP endpoints (server.ts)

All of these live in the Express process on port 3000, with no authentication and CORS `*` (SRV-1). Every path except the logs has a `/mcp/...` and an `/api/mcp/...` alias.

| Family | Method and paths | Lines | Behaviour (verified by running unless noted) |
|---|---|---|---|
| SSE stream | `GET /mcp/sse`, `GET /api/mcp/sse` | `server.ts:248-272` | Creates a new `McpServer` and an SDK `SSEServerTransport` per connection. The first event is `event: endpoint` / `data: /api/mcp/messages?sessionId=<uuid>`, always the `/api` path. Sessions are kept in an in-memory `Map` and removed when the request closes. This is the SDK's deprecated transport, with DNS-rebinding protection off (MCP-22). |
| SSE messages | `POST /mcp/messages`, `POST /api/mcp/messages` | `server.ts:274-297` | Session id from `?sessionId=` or the `x-session-id` header. Returns 202, and the JSON-RPC reply arrives on the SSE stream as `event: message`. Missing id gives 400 `{"error":"Missing sessionId query parameter"}`; an unknown id gives 404. The SDK negotiates the protocol version (a `2025-06-18` request was echoed back). |
| Direct JSON-RPC | `POST /mcp`, `POST /api/mcp` | `server.ts:299-314`; `doeMcpServer.ts:1319-1447` | One shared server instance (`server.ts:245`) and a hand-written dispatcher, not an SDK transport. See [Direct JSON-RPC dispatcher](#direct-json-rpc-dispatcher). The in-app MCP playground uses this path. |
| Info | `GET /mcp/info`, `GET /api/mcp/info` | `server.ts:316-358` | `{status, name, version, protocolVersion: '2024-11-05', activeSessions (SSE count), endpoints, toolsCount, tools[{name, description, parameters}], resources, prompts[{name, description}]}`. Built from the SDK's private `_registeredTools` / `_registeredResources` / `_registeredPrompts`. `parameters` is serialised zod, not JSON Schema, and `resources` lists only `doe://projects` (MCP-17). |
| Logs | `GET /api/mcp/logs` (no `/mcp` alias) | `server.ts:360-363` | The activity log array, newest first. |

### Direct JSON-RPC dispatcher

`handleDirectJsonRpc` (`doeMcpServer.ts:1319-1447`) behaves differently from the SDK paths:

| Method | Behaviour |
|---|---|
| `initialize` | Hard-coded result with `protocolVersion: '2024-11-05'`. |
| `tools/list` | Each `inputSchema` is the serialised zod object (`{"def": {...}, "type": ...}`), not JSON Schema. |
| `tools/call` | Calls `tool.handler(args)` directly, so zod validation and defaults are skipped (MCP-5). Ran: `create_project` with two numeric factors gave 0 runs with `designType`, `centerPoints` and factor `type` all undefined. The same call through an SDK client gave 7 runs (2² + 3 centre points), `factorial_2level` and `centerPoints` 3. |
| `resources/list` | Returns only `doe://projects`; both templates are missing. |
| `prompts/list` | Returns `arguments: []` for both prompts. |
| `ping` | Returns `{}`. |
| anything else | JSON-RPC error `-32601` with HTTP 200. That covers `resources/read`, `prompts/get` and notifications. A notification without an id gets an error reply with `id: 1`, because `id` defaults to 1. |

## stdio entry

`npm run mcp` runs `tsx src/server/mcp/stdio.ts` (`package.json:10`). On start, `stdio.ts`:

1. Reads `<cwd>/data.json` once (`stdio.ts:8-19`).
2. Seeds samples only if the projects or folders list is empty (`:21-27`).
3. Purges the two legacy sample ids (`:29-30`).
4. Builds its own context (`:40-58`).
5. Connects a `StdioServerTransport` (`:60-65`).

It logs only to stderr. Points to know:

- **Banner on stdout.** Ran: plain `npm run mcp` prints `> react-example@0.0.0 mcp` / `> tsx src/server/mcp/stdio.ts` on stdout before the first JSON-RPC message. `npm run -s mcp` prints nothing extra (MCP-18).
- **Not part of `npm run build`.** It needs the `tsx` devDependency at runtime. The `#!/usr/bin/env node` shebang (`stdio.ts:1`) is misleading: node cannot run the `.ts` file.
- **Working directory.** `data.json` resolves against the process working directory, so the client must start it in the repo root (SRV-8).

## How state is shared with server.ts

Tools never touch the file system. They go through the `McpDatabaseContext` interface (`doeMcpServer.ts:8-15`), which each host implements over its own in-memory `db`:

| Member | `server.ts:222-243` (HTTP host) | `stdio.ts:40-58` (stdio host) |
|---|---|---|
| `getProjects` / `getFolders` | `db.projects \|\| []` / `db.folders \|\| []` | `db.projects` / `db.folders` |
| `saveProject(p)` | Sets `updatedAt`, upserts, rewrites `data.json`, `io.emit('sync_data', db)` to every browser | Upserts and rewrites `data.json`; no `updatedAt`, no broadcast |
| `deleteProject(id)` | Filters, rewrites `data.json`, `io.emit` | Filters, rewrites `data.json` |
| `saveData` | Whole-file write; not called by any tool | Same |
| `broadcastSync` | `io.emit('sync_data', db)` again, so each MCP write reaches browsers twice (MCP-23) | No-op |

Consequences:

- **HTTP host (SSE and direct JSON-RPC).** MCP and the web UI share one in-memory `db`. MCP writes reach open browser tabs immediately through socket.io. They are still whole-project last-writer-wins against browser saves (DATA-4).
- **Tools mutate the live project object in place** before calling `saveProject` (for example `doeMcpServer.ts:350-355`, `:469-472`, `:553`, `:916-923`). Because the seeded `db` holds the sample module's own objects, MCP edits also change the module-level `sampleProjects` (DATA-14). Until P0.1 that edited object was what "reset sample data" restored; the reset now builds new objects with `createSampleProjects()`.
- **stdio host.** It is a second process with its own copy of `data.json`, loaded once. Neither process reloads the file, and whichever writes last overwrites the other's changes. stdio writes never reach the browser (DATA-3, MCP-20).

For the full data flow see [Server and persistence](server-and-persistence.md#data-flow).

## Activity log

`mcpActivityLogs` is a module-level array (`doeMcpServer.ts:29-41`): newest first, capped at 100 entries, in memory only.

- In the HTTP host, the direct dispatcher and every SSE session write to the same array, which `/api/mcp/logs` serves.
- The stdio process has its own array, which nothing reads.
- Tools log success and failure with a measured duration.
- Resources log only success, with a hard-coded `durationMs: 5`. Prompts are never logged.
- `params` are stored and served without authentication.

This is an activity log, not an audit trail (MCP-21, DATA-16).

## Connecting a client

**Pick one host per data file.** Use the SSE endpoint while the web app is running: it shares the server's `db`, and changes appear in browsers. Use stdio only when `npm run dev` / `npm start` is **not** running against the same `data.json` (DATA-3).

### stdio (Claude Desktop and other local clients)

Run `npm install` in the repo first. Then add this to Claude Desktop's `claude_desktop_config.json`, replacing the path with the absolute path of your checkout:

```json
{
  "mcpServers": {
    "doe-magic": {
      "command": "npm",
      "args": ["--prefix", "/absolute/path/to/DOE-Magic", "run", "-s", "mcp"]
    }
  }
}
```

- `--prefix` makes npm find `package.json` and run the script with the repo as the working directory, so `data.json` resolves to the repo copy. `-s` keeps npm's banner off stdout. Verified from an unrelated directory (npm 11, Node 24): a script started with `npm --prefix <dir> run` reports `<dir>` as its working directory, and the reply to `initialize` was clean JSON.
- If the client supports a `cwd` field, `{"command": "npm", "args": ["run", "-s", "mcp"], "cwd": "/absolute/path/to/DOE-Magic"}` is equivalent. Whether Claude Desktop honours `cwd` is unverified.
- **Windows.** `npm` is a `.cmd` shim, which some clients cannot spawn directly. Use `"command": "cmd", "args": ["/c", "npm", "--prefix", "D:\\path\\to\\DOE-Magic", "run", "-s", "mcp"]`. This command line ran here from a shell; it was not tested inside Claude Desktop.
- The snippet the in-app MCP panel shows, `{command: 'npm', args: ['run', 'mcp']}` (`src/web/features/mcp-panel/McpModal.tsx:178-189`), has no working directory and no `-s`, so it does not work as given (MCP-18).

### SSE (remote)

Start the app (`npm run dev`). The SSE URL is `http://localhost:3000/mcp/sse` (or `/api/mcp/sse`). Claude Code:

```bash
claude mcp add --transport sse doe-magic http://localhost:3000/mcp/sse
```

This form is taken from `claude mcp add --help`; it was not run against this server. The SSE handshake itself was verified with curl.

- The in-app panel's `{url: <origin>/mcp/sse}` snippet (`McpModal.tsx:166-176`): whether each client accepts this form is unverified (MCP-18).
- Do not point a Streamable HTTP client (`--transport http`) at `/mcp` or `/api/mcp`. Those paths are the hand-written dispatcher, not an MCP transport (MCP-17).
- Anything that can reach port 3000 can call every tool, including `delete_project` (SRV-1). Do not expose the port beyond a trusted machine.

### Direct JSON-RPC (scripts, the in-app playground)

```bash
curl -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'
```

- Arguments are not validated and defaults are not applied (MCP-5).
- The in-app playground (`McpModal.tsx:78-113`) is pre-filled with calls that modify the demo project (UI-20).

## What reuses core and what re-implements it

| Logic | Status | Where |
|---|---|---|
| Design generation | **Reused**: core `generateDesign` (`src/core/design/doeGenerator.ts:20`) | `doeMcpServer.ts:273`, `:462`. The browser uses a separate fork inside `ProjectDesign.tsx`, so MCP and UI designs can differ (MCP-19, DES-8). |
| OLS / ANOVA / effects | **Reused**: core `computeAnalysis` (`src/core/analysis/analysisCore.ts:186`) | `doeMcpServer.ts:624`, `:723`, `:794`, `:989`, `:1213` |
| Prediction | **Reused**: core `predictModelResponse` (`src/core/analysis/analysisCore.ts:1192`) | `doeMcpServer.ts:732`, `:884`, `:1027` |
| Desirability (bounds, `d_i`, weighted geometric mean) | **Re-implemented**; differs from core and from the Profiler | `doeMcpServer.ts:815-853`, `:879-895` (MCP-3, STAT-6) |
| Optimum grid search | **Re-implemented**; differs from core's 512-cap grid | `doeMcpServer.ts:797-867` (MCP-11, STAT-4) |
| Monte Carlo robustness and Cpk | **Re-implemented**; differs from the UI copy | `doeMcpServer.ts:992-1074` (MCP-2, MCP-16, STAT-9) |
| Field mapping of analysis results | Hand-written against an untyped result | `doeMcpServer.ts:627-670` (MCP-1, MCP-6, MCP-9) |
| MCP protocol handling for `POST /mcp` | **Re-implemented** instead of an SDK transport | `doeMcpServer.ts:1319-1447`, `server.ts:299-314`; the info endpoint reads private SDK fields at `server.ts:316-358` (MCP-5, MCP-17) |
| Store bootstrap (load, seed, purge, save) | **Duplicated** between the hosts | `stdio.ts:8-58` vs `server.ts:9-68`, `:222-243` (MCP-20) |

The modules the MCP server imports are free of DOM globals and of `console.log`, so stdout stays clean on stdio (grep of `src/core` and `src/server`).

- `npm run check` enforces only part of the DOM rule: R3 rejects browser globals in `src/core`, and R4 and R7 keep browser modules out of the Node import graph. Browser globals written directly in `src/server` are not checked.
- Nothing enforces the stdout part. Never log to stdout from `src/core` or `src/server`; use `console.error`.

## Changing the MCP server

- New tools go in `createDoeMcpServer` and must call `src/core` for any calculation. Never add a fourth copy of a formula (see [forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md)).
- Tool names, inputs, defaults and outputs are a contract. Write the change into this doc before implementing it, in the same PR ([design spec](../../spec/DOE-Magic/design-spec.md) §9.2). Update the tool list in design spec §6.3 if a tool is added, renamed or removed.
- Until MCP-20 is fixed, any change to the store context must be made in both `server.ts:222-243` and `stdio.ts:40-58`.
- After editing, restart `npm run dev`. `tsx server.ts` runs without watch mode, so the server keeps the old MCP code until it restarts.

## Known issues

From the [issue registry](../../spec/DOE-Magic/roadmap-backlog.md). Basis: R = confirmed by running, C = confirmed by reading, P = plausible, unverified.

| ID | Sev | Issue | Basis |
|---|---|---|---|
| MCP-1 | Critical | `run_analysis` reports the model DF as the overall model p-value; the `interpret_doe_results` prompt then judges significance on it | R |
| MCP-2 | Critical | `simulate_robustness` clamps samples to `[0.9*min, 1.1*max]`, which is wrong for zero or negative ranges and truncates tails | R |
| MCP-3 | High | Three desirability functions (MCP, analysisCore, Profiler) disagree | C |
| MCP-4 | High | Substring project/response lookup: destructive tools can hit the wrong project, and an empty id deletes the first project | R |
| MCP-5 | High | `POST /api/mcp` `tools/call` skips zod validation and defaults | R |
| MCP-6 | High | `paretoRanking` reads non-existent fields: no term names, magnitude 0, no significance flag | R |
| MCP-7 | High | `excludedTerms` documented as names but matches only ids | R |
| MCP-8 | High | Lack of fit reported as "not significant, model adequate" when it cannot be tested | C |
| MCP-9 | High | `run_analysis` crashes on saturated models with a 3+ level categorical factor | R |
| MCP-10 | High | `generate_doe_design` replaces recorded measurements without a guard; a stored `project.centerPoints` of 0 becomes 3 when the call omits `centerPoints` (an explicit `centerPoints: 0` is honoured, `:460`) | R |
| MCP-11 | High | `optimize_desirability` grid guard drops factors, saves candidates with missing values, and blocks the event loop | R |
| MCP-12 | Medium | Optimum saved even without a fitted model; weight 0 treated as 1; overwrites the UI's optimisation report | C |
| MCP-13 | Medium | D-efficiency multiplied by 100 twice (for example `10000.0%`) | R |
| MCP-14 | Medium | `add_run_results` stores unknown response keys verbatim, matches runs ambiguously, and skips unmatched runs silently | C |
| MCP-15 | Medium | `predict_response` ignores unknown factor keys and gives no interval or extrapolation warning | C |
| MCP-16 | Medium | Monte Carlo duplicated in MCP and UI with different maths and defaults; "Cpk" is Ppk-like | R |
| MCP-17 | Medium | Hand-written dispatcher is non-conformant and depends on private SDK fields | R |
| MCP-18 | Medium | The stdio config shown in the UI does not work as given (no working dir, npm banner, plain `npm` on Windows) | R |
| MCP-19 | Medium | MCP (core) and UI (inline fork) design generation are separate | C |
| MCP-20 | Medium | `stdio.ts` copies the store bootstrap from `server.ts`, and the copies have drifted | C |
| MCP-21 | Medium | "Audit log" is an in-memory 100-entry buffer with fake durations and gaps | C |
| MCP-22 | Low | Remote MCP uses the deprecated SSE transport with an in-memory session map; no Streamable HTTP | C |
| MCP-23 | Low | Each MCP write broadcasts the whole DB twice; unused context members; deprecated overloads; metadata hard-coded in several places | C |

Related issues in other areas:

- STAT-4: optimum truncation, including the MCP grid.
- STAT-12: MCP `run_analysis` overlap.
- DES-1: generation overwrites runs.
- DES-5: D-efficiency.
- SRV-1: no auth, CORS `*`.
- DATA-3: two processes, one file.
- DATA-4: last-writer-wins.
- DATA-7: unvalidated payloads break `list_projects`.
- DATA-14: shared sample objects.
- DATA-20: duplicate `runOrder` values make `add_run_results` matching ambiguous.
- DATA-22: `create_project` stores the zod defaults 0/100 as a categorical factor's `min`/`max`, and `simulate_robustness` falls back to their midpoint (`:1015`).
- DATA-23: `optimize_desirability` keys candidates by factor name (`:898-900`, `:916-921`), so duplicate names collide.
- UI-31: the HTML report prints the same DF field as "Model p-value"; same root cause as MCP-1, fixed with it.
- UI-20: the playground defaults mutate the demo project.

No unregistered issues were found in this area.
