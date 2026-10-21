# DOE-Magic — Server and Persistence

> Created: 2026-10-20. Status: describes `server.ts`, the JSON-file store and the browser cache as they are on branch `chore/project-structure-and-core-docs` (behaviour unchanged by the `src/` restructure); verified against the code, partly by running the server in an isolated directory. The reset endpoint, the demo buttons and the line numbers were updated for P0.1 on 2026-10-21 and checked by running.
> Related: [MCP server](mcp-server.md), [Web UI](web-ui.md), [AI Studio origin](ai-studio-origin.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Runtime data in git](../../memory/DOE-Magic/runtime-data-in-git.md), [AI Studio sync overwrites repo](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md)

One Node process, [`server.ts`](../../../server.ts) (394 lines), serves everything on port 3000:

- the SPA
- the REST API
- socket.io live sync
- MCP over HTTP

All data lives in one untyped in-memory object, `db = {projects, folders}`. It is mirrored to `<cwd>/data.json` and cached in every browser's `localStorage`. A second process, the stdio MCP server (`npm run mcp`), keeps its own copy of the same file. There is no authentication, no schema version and no conflict detection.

## server.ts anatomy

| Lines | Content |
|---|---|
| `1-6` | Imports: express, http, socket.io, path, fs, cors. |
| `8-9` | `PORT = 3000` (hard-coded); `DATA_FILE = path.join(process.cwd(), 'data.json')`. |
| `11-18` | Express app with `cors()` (any origin) and `express.json({limit: '50mb'})`. One `http.createServer(app)` is shared by Express, socket.io (`cors: {origin: '*'}`) and Vite HMR. |
| `20-22` | Project imports: `src/core/sampleProject`, the SDK `SSEServerTransport`, `src/server/mcp/doeMcpServer`. |
| `24-34` | Load `data.json` synchronously if it exists. A parse error is only logged. A file that parses to `null` crashes startup at `:37` (SRV-13). |
| `36-60` | Seed samples and purge legacy ids (see [Seeding and legacy purge](#seeding-and-legacy-purge)). |
| `62-68` | `saveData()`: synchronous, non-atomic, pretty-printed whole-file `writeFileSync`. |
| `70-120` | socket.io handlers. |
| `122` | Comment: the Gemini integration was removed. |
| `124-217` | REST routes. |
| `219-243` | `mcpContext`: the store adapter handed to the MCP server. |
| `245-363` | MCP endpoints: SSE, messages, direct JSON-RPC, info, logs (see [MCP server](mcp-server.md#http-endpoints-serverts)). |
| `365-392` | `startServer()`: Vite dev middleware or static `dist/`, then `listen(3000, '0.0.0.0')`. |

All API and MCP routes are registered at module top level, before `startServer()` adds Vite or the static fallback, so they take precedence.

## REST routes

| Method | Path | Request | Response | Side effects | Lines |
|---|---|---|---|---|---|
| GET | `/api/health` | none | `{status: 'ok'}` | none | `124-126` |
| GET | `/api/data` | none | the whole `db` | none | `129-131` |
| GET | `/api/projects` | none | `Project[]` | none | `133-135` |
| POST | `/api/projects` | a `Project` (only `id` is checked) | `{success, project}`; 400 `{error}` without `id` | Sets `updatedAt`, upserts the whole project, writes the file, `io.emit('sync_data', db)` to **all** clients | `137-152` |
| DELETE | `/api/projects/:id` | none | `{success: true}`, even for an unknown id | Hard delete, write, emit to all | `154-160` |
| GET | `/api/folders` | none | `Folder[]` | none | `162-164` |
| POST | `/api/folders` | a `Folder` (only `id` is checked) | `{success, folder}`; 400 without `id` | Upsert, write, emit to all | `166-180` |
| DELETE | `/api/folders/:id` | none | `{success: true}` | Removes the folder, clears `folderId` on its projects, write, emit to all | `182-192` |
| POST | `/api/reset-sample` | JSON `{"confirm": true}`; anything else gets 400 and changes nothing | `{success, data: db, backup}`; `backup` is the backup file name, or `null` when no `data.json` existed; 500 `{error}` if the backup fails | Copies `data.json` to `data.json.before-reset-<timestamp>`, then **replaces the whole db with new sample objects**, write, emit to all (P0.1) | `194-217` |
| various | `/mcp/*`, `/api/mcp/*` | see [MCP server](mcp-server.md) | | | `248-363` |
| GET | `*` (production only) | none | `dist/index.html` | none | `384-386` |

Callers in `src/web`: only `src/web/state/ProjectContext.tsx` (`/api/data`, POST/DELETE projects and folders, reset) and `src/web/features/mcp-panel/McpModal.tsx` (`/api/mcp/info`, `/api/mcp/logs`, `POST /api/mcp`). `GET /api/health`, `GET /api/projects` and `GET /api/folders` have no caller in the app.

Verified by running: responses carry `Access-Control-Allow-Origin: *` for any `Origin`.

## socket.io events

The server uses the default path `/socket.io`. The client is created with `io({transports: ['polling', 'websocket'], timeout: 4000, reconnectionAttempts: 3})` (`ProjectContext.tsx:127-131`). Nothing handles the give-up after the third failed reconnect (DATA-21).

| Direction | Event | Payload | Server behaviour | Lines |
|---|---|---|---|---|
| server to client | `sync_data` | the whole `db` | Sent on every new connection; after a socket write, to the **other** clients (`socket.broadcast.emit`); after a REST or MCP write, to **all** clients (`io.emit`) | `server.ts:75`, `86`, `150` and the other write paths |
| client to server | `update_project` | `Project` | Upsert with no `id` check and no `updatedAt`, write, broadcast to others | `server.ts:78-87` |
| client to server | `delete_project` | id | Hard delete, write, broadcast | `server.ts:89-93` |
| client to server | `update_folder` | `Folder` | Upsert, write, broadcast | `server.ts:95-104` |
| client to server | `delete_folder` | id | Remove the folder and un-file its projects, write, broadcast | `server.ts:106-115` |

The client listens to `sync_data` (`ProjectContext.tsx:134-145`) and `connect_error` (`:147-150`). It emits the four write events at `:193`, `:214`, `:240` and `:265`. Payloads are not validated anywhere (DATA-7).

## MCP mounting

`mcpContext` (`server.ts:222-243`) implements `McpDatabaseContext` over the same `db`. Its `saveProject` sets `updatedAt`, upserts, writes the file and emits `sync_data`; `broadcastSync` emits again.

- One shared `McpServer` (`:245`) answers the direct JSON-RPC and info endpoints.
- Each SSE connection gets its own `McpServer`, all over the same context (`:251`).
- Sessions are held in an in-memory `Map` (`:246`).

Details: [MCP server](mcp-server.md).

## Dev mode and production mode

| | Development: `NODE_ENV !== 'production'` (`server.ts:366-380`) | Production: `NODE_ENV === 'production'` (`server.ts:381-386`) |
|---|---|---|
| Front end | `await import('vite')`, then `createViteServer({server: {middlewareMode: true, hmr: {server: httpServer, clientPort}}, appType: 'spa'})` and `app.use(vite.middlewares)`. No `root` or `configFile` is passed, so Vite finds `vite.config.ts` and `index.html` through `process.cwd()`. | `express.static(<cwd>/dist)` plus a catch-all `GET *` that returns `dist/index.html`. |
| HMR | WebSocket on the shared HTTP server. `clientPort` is 443 when `K_SERVICE` or `APP_URL` is set (AI Studio / Cloud Run proxy), otherwise 3000. | none |
| Unknown GET such as `/api/nope` or `/mcp/x` | Handled by Vite's SPA fallback; not run | 200 with `index.html` (SRV-7; ran with a stub `dist/`) |
| Files exposed | Vite serves the source tree and `public/` | Everything in `dist/`, including `server.cjs.map` once built (SRV-2; ran with a stub file) |

- `npm run dev` is `tsx server.ts` with no watch mode. Browser code hot-reloads, but `server.ts`, `src/server/**` and the server's copy of `src/core/**` (used by MCP) only change after a restart.
- `vite.config.ts:15-21` sets `hmr: false` and `watch: null` when `DISABLE_HMR=true`. The inline `hmr` object in `server.ts:373-376` probably overrides `hmr: false`, so only `watch: null` would take effect (SRV-10; inferred, not run).
- `index.html:12-32` suppresses WebSocket and `@vite/client` errors so that HMR failures in the AI Studio proxy stay silent.

## Environment variables actually read

| Variable | Where | Effect |
|---|---|---|
| `NODE_ENV` | `server.ts:366` | Anything except `production` selects Vite dev middleware. |
| `K_SERVICE` | `server.ts:368` | Presence only: HMR `clientPort` 443. |
| `APP_URL` | `server.ts:368` | Presence only: HMR `clientPort` 443. |
| `DISABLE_HMR` | `vite.config.ts:18`, `:20` | `'true'` turns off HMR and file watching (dev only; see SRV-10). |

Not read:

- **`PORT` and `HOST`.** The port is fixed at 3000 on `0.0.0.0` (`server.ts:8`, `:389`).
- **`GEMINI_API_KEY`.** It is listed in `.env.example:1-4` but unused.
- **`.env`.** `dotenv` is a dependency but is never imported, so the server does not load a `.env` file.
- **`import.meta.env`.** No client code uses it.

## Data flow

```text
Browser tab (every tab of every user)
  React state: projects, folders
    |  every mutation is written through to
    v
  localStorage: doe_magic_projects, doe_magic_folders  (whole arrays, unversioned keys)
    |
    |  HTTP:   GET /api/data once on load
    |          POST|DELETE /api/projects, /api/folders;  POST /api/reset-sample
    |  socket: emit update_project | delete_project | update_folder | delete_folder
    |  socket: receive sync_data = whole db -> replaces state and cache (ignored if 0 projects)
    v
Express process: server.ts, port 3000
  db = { projects, folders }   in memory, untyped (`any`)
    ^
    |  MCP over HTTP (SSE sessions + POST /api/mcp) via mcpContext: same db;
    |  each MCP write -> data.json rewrite + sync_data to all browsers (twice)
    |
    |  read once at startup; each write = synchronous whole-file rewrite
    v
<cwd>/data.json   gitignored; created on the first write when missing
    ^
    |  read once at startup; each write = whole-file rewrite; never reloads
    |
stdio MCP process (npm run mcp): its own db copy, no broadcast;
browsers never see its writes, and the two processes overwrite each other (DATA-3)
```

**What one UI edit does.** `saveProject` (`ProjectContext.tsx:172-195`) runs on many keystrokes, for example `ProjectSetup.tsx:182`. Each call:

1. Mutates `project.updatedAt` on the caller's object.
2. Updates React state and rewrites the `doe_magic_projects` cache.
3. POSTs `/api/projects`. The server writes `data.json` and emits `sync_data` to every client, the sender included.
4. If the socket is connected, also emits `update_project`. The server writes `data.json` again and broadcasts to the other clients.

So one edit means two full-file writes. Every other tab receives the whole database twice, and the sender receives its own echo once (DATA-8, SRV-9).

Two other client behaviours:

- `deleteProject` (`:197-220`) archives on the first call and hard-deletes on the second.
- Failed HTTP saves are only logged with `console.warn`, and the status code is not checked (DATA-5).

**Client startup** (`ProjectContext.tsx:24-170`):

1. Initial state comes from the cache. Legacy ids are dropped and the demo project or folder is prepended if missing. If the cache is empty, or any cached project fails a shallow check (`id` plus `factors`, `responses` and `runs` arrays), the samples are used instead.
2. `GET /api/data`. If the server has at least one project, its data replaces state and cache. If it has 0 projects, the client keeps its local data and POSTs its cached `projects[0]` and `folders[0]` to the server (DATA-13).
3. socket `sync_data` does the same replacement whenever the payload has at least one project.

`loading` is never set to `true`.

**Other browser-only storage:**

- `app_language` (`LanguageContext.tsx:16`, `:29`)
- `darkMode` (`Layout.tsx:27-36`)
- `axiom_doe_sop_steps_v1`, the SOP guide steps (`GuideView.tsx:21`). These never reach the server (DATA-19).

## Seeding and legacy purge

The demo study is the Suzuki-Miyaura project `proj-suzuki-cross-coupling` in folder `folder-coupling`, defined in `src/core/sampleProject.ts`. `sampleProjects` and `sampleFolders` are built once per process at module load (`sampleProject.ts:297-299`). `createSampleProjects()` and `createSampleFolders()` (`:289-295`) build new objects on every call; the reset uses them. `createDemoProjectCopy(existing)` (`:280-286`) is the demo copy that the demo buttons add.

| Where | Store empty | Store not empty | Legacy purge |
|---|---|---|---|
| `server.ts:36-60` | `db.projects = [...sampleProjects]` (shallow copy: `db` holds the module's own objects, DATA-14) | Pushes back any sample project or folder whose id is missing, so a deleted demo returns on every restart (DATA-13) | Removes `proj-api-synthesis-01` and `folder-synthesis` |
| `src/server/mcp/stdio.ts:21-30` | Same shallow copy | Nothing (differs from `server.ts`, MCP-20) | Same purge |
| Browser cache (`ProjectContext.tsx:24-68`) | `[...sampleProjects]`, `[...sampleFolders]` | Prepends `demoCatalyticProject` / `demoFolder` if missing | Same purge |
| `POST /api/reset-sample` (`server.ts:194-217`) and client `resetSampleData` (`ProjectContext.tsx:269-291`) | Replaces **everything** with `createSampleProjects()` / `createSampleFolders()`, on the server and then in the cache, after a backup of `data.json`. Needs the body `{"confirm": true}`. The only UI caller is "Reset Sample Data" in the Archive view (`src/web/pages/Dashboard.tsx:225-234`), behind `ConfirmDialog` (P0.1) | | |
| Client `loadDemoProject` (`ProjectContext.tsx:293-301`) | Adds `createDemoProjectCopy(projects)` with `saveProject`, and the demo folder with `saveFolder` if it is missing. Keeps the demo id unless a project already has it, else a new uuid; never replaces a project. Called by "Demo Studies" and "Load Demo Experiments" (`Dashboard.tsx:202`, `:385`) | | |

Startup seeding (server and stdio) does not write `data.json` by itself. A missing file is created on the first write (any save, delete or reset); verified by running: `POST /api/reset-sample` in an empty directory created `data.json` there (before P0.1; a reset now also needs the confirm body, and writes no backup when there is no file yet).

There is no schema version in `data.json`, in `Project` or in the cache keys. The purge above is the only "migration", and it is copied in three places (DATA-12).

## Build and deploy

| Step | Command | Result |
|---|---|---|
| Build | `npm run build` (`package.json:8`) | `vite build` writes `dist/index.html`, `dist/assets/*` and the copied `public/` files (`logo.png`, `plotly.min.js`). Then `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` adds `dist/server.cjs` and `dist/server.cjs.map`. npm packages stay external, so the runtime needs `node_modules`. |
| Run | `npm start` = `node dist/server.cjs` (`package.json:9`) | Does **not** set `NODE_ENV`, so it runs the dev branch: Vite middleware over the source tree (SRV-3, BLD-1). Use `NODE_ENV=production npm start` (bash) or `$env:NODE_ENV='production'; npm start` (PowerShell). The PowerShell form leaves `NODE_ENV` set for that window, so a later `npm run dev` there serves the old `dist/`; close the window or run `Remove-Item Env:NODE_ENV`. |
| stdio MCP | `npm run mcp` | Not built; runs the TypeScript source through `tsx` (a devDependency). |

`dist/` is gitignored. The production server serves everything in `dist/`, including the server bundle and its source map (SRV-2, BLD-2). The CJS bundle `require()`s ESM-only `uuid@14` (`dist/server.cjs` has two `require("uuid")` calls; `uuid` 14.0.2 is `"type": "module"` with no `require` export), and `package.json` declares no `engines` (SRV-6, BLD-13). So the production bundle needs Node ≥ 22.12, or ≥ 20.19 on the 20.x line, where `require(esm)` is on by default. Confirmed by running: `node --no-experimental-require-module dist/server.cjs` (Node 24.13.0 with `require(esm)` turned off, simulating an older Node) fails with `ERR_REQUIRE_ESM` on `node_modules/uuid/dist-node/index.js`. The local smoke tests ran on Node 24.13.0.

### AI Studio / Cloud Run assumptions

Keep these unless AI Studio compatibility is deliberately dropped. See [AI Studio origin](ai-studio-origin.md).

| Assumption | Where | Note |
|---|---|---|
| Port 3000 on `0.0.0.0` | `server.ts:8`, `:389` | `PORT` is ignored (SRV-8). |
| One process serves the SPA, REST, socket.io and MCP from one origin | `server.ts` | API routes are registered before the Vite/static middleware. |
| HMR behind an HTTPS proxy | `server.ts:368-376` | `clientPort` 443 when `K_SERVICE` or `APP_URL` is set. `.env.example:6-8` says AI Studio injects `APP_URL` with the Cloud Run service URL. |
| `DISABLE_HMR` switch | `vite.config.ts:15-21` | The file says "Do not modify". Partly ineffective (SRV-10). |
| Silenced HMR socket errors | `index.html:12-32` | Hides WebSocket failures in the AI Studio preview. |
| Working directory = repo root | `server.ts:9`, `:382`; `stdio.ts:8`; Vite config discovery | Starting from another directory silently creates a fresh, sample-seeded `data.json` there (SRV-8). |
| `base: './'` | `vite.config.ts:8` | Contradicted by root-absolute `/plotly.min.js`, `/logo.png`, `/api/...` and `/socket.io` (SRV-12). |
| Container filesystem | `data.json` | On Cloud Run it is temporary and per instance (DATA-9). |

Unverified: how AI Studio itself starts the app (dev server or build plus start, and with which `NODE_ENV`) and whether a Cloud Run deployment is in use.

## Known issues

From the [issue registry](../../spec/DOE-Magic/roadmap-backlog.md). Basis: R = confirmed by running, C = confirmed by reading, P = plausible, unverified.

### Server (SRV)

| ID | Sev | Issue | Basis |
|---|---|---|---|
| SRV-1 | High | No authentication; CORS `*` on REST and socket.io; listens on `0.0.0.0`. Any website or LAN host can read, overwrite or wipe all data. | C |
| SRV-2 | High | The production server serves its own bundle and source map (`GET /server.cjs.map`). | C |
| SRV-3 | High | `npm start` does not set `NODE_ENV=production`, so the "production" server runs Vite dev middleware. Same defect as BLD-1. | C |
| SRV-4 | Medium | Over plain HTTP on a LAN IP, `crypto.randomUUID` and `navigator.clipboard` are missing and features break. | C |
| SRV-5 | Medium | `server.ts` is an untyped monolith; upsert logic is copied 4+ times and has drifted. | C |
| SRV-6 | Medium | The CJS bundle `require()`s ESM-only `uuid@14`; no `engines` declared. The production bundle needs Node ≥ 22.12 (or ≥ 20.19), where `require(esm)` is on by default. Same defect as BLD-13. | R |
| SRV-7 | Low | In production, unknown `/api/*` and `/mcp/*` GETs return `index.html` with 200; 500s echo internal messages. | C |
| SRV-8 | Low | Port hard-coded, `.env` never loaded, every path depends on `process.cwd()`. | C |
| SRV-9 | Low | Every write pretty-prints the whole DB to disk and broadcasts the whole DB; 50 MB body limit. | C |
| SRV-10 | Low | `DISABLE_HMR` only disables file watching; the inline `hmr` object overrides `hmr: false`. | P |
| SRV-11 | Low | Unused dependencies, Gemini leftovers, template package identity, version string hard-coded in 10 places in 7 files (listed under BLD-8). | C |
| SRV-12 | Low | Root-absolute asset and API paths contradict Vite `base: './'`; root-only hosting. | C |
| SRV-13 | Medium | A `data.json` that parses to a non-object (for example `null`) crashes startup instead of re-seeding: `server.ts:28` sets `db` to `null`, `:29` throws inside the `try` (logged as a parse failure), then `:37` throws an uncaught `TypeError`. `stdio.ts:13`, `:14` and `:21` have the same pattern. | R |

### Persistence and data integrity (DATA)

| ID | Sev | Issue | Basis |
|---|---|---|---|
| DATA-1 | Critical | **Fixed in P0.1 (2026-10-21).** The "Demo Studies" / "Load Demo Experiments" buttons wiped every project and folder for all users, with no confirmation. They now add a copy of the demo, and the reset needs confirmation in the UI and on the server. | C |
| DATA-2 | High | Non-atomic `data.json` write; a corrupt file is replaced by samples and then overwritten. | C |
| DATA-3 | High | The Express server and the stdio MCP both own `data.json` with separate in-memory copies, so updates are lost. | C |
| DATA-4 | High | Whole-project last-writer-wins with no version check (stale tabs, other users, MCP). | C |
| DATA-5 | High | Failed saves are invisible to the user, and the edits are later discarded. | C |
| DATA-6 | High | Excel run-matrix import invents or drops values and replaces all runs. | C |
| DATA-7 | High | The server stores any payload shape; one malformed project breaks MCP listing and UI pages for everyone. | R |
| DATA-8 | High | Double save (HTTP + socket) with echo to the sender can revert or lose quick successive edits. | P |
| DATA-9 | High | On Cloud Run, `data.json` lives on the container's temporary filesystem. | P |
| DATA-10 | Medium | JSON project import barely validates its input. | C |
| DATA-11 | Medium | Edits to factors, responses and metadata do not cascade, leaving orphaned data. | C |
| DATA-12 | Medium | No schema version anywhere; the only migration is a legacy-id purge copied into three places. | C |
| DATA-13 | Medium | Deleted demo data comes back; an empty server is refilled from the browser cache. | C |
| DATA-14 | Medium | Sample constants are shared by reference and mutated in place, so seeding hands out objects that MCP edits change. (Until P0.1, "reset" restored such an edited sample; it now builds new objects.) | R |
| DATA-15 | Medium | Opening the Robustness tab writes the project; simulation results are persisted inside it. | C |
| DATA-16 | Medium | No change history, audit trail, user identity or backups. | C |
| DATA-17 | Medium | Permanent deletes (Archive view) and folder deletes happen on a single click. | C |
| DATA-18 | Low | Browser cache: unversioned keys, swallowed quota errors, whole cache discarded if one entry is invalid. | C |
| DATA-19 | Low | SOP guide steps are stored only in one browser's `localStorage`. | C |
| DATA-20 | Low | IDs and run order are generated inconsistently and can collide. | C |
| DATA-21 | Medium | The socket.io client gives up after `reconnectionAttempts: 3` and nothing handles `reconnect_failed` (`ProjectContext.tsx:127-131`). After a short outage the tab never receives `sync_data` again until reloaded, while every edit still POSTs the whole project, so a stale tab silently overwrites newer data. | C |
| DATA-22 | Low | Categorical `Factor.min`/`max` has no single convention: the UI writes 0 and L−1 (`ProjectSetup.tsx:76-77`, `:115-116`), MCP `create_project` writes the zod defaults 0/100 (`doeMcpServer.ts:229-230`), and `simulate_robustness` falls back to the numeric midpoint (`:1015`). | C |
| DATA-23 | Medium | Factor and response names are not checked for uniqueness, yet some paths key by name (`optimize_desirability`, `doeMcpServer.ts:898-900`, `:916-921`; Excel import, `ProjectDesign.tsx:254-292`), so duplicate names silently collide. | C |

Related issues in other areas:

- BLD-1 duplicates SRV-3; BLD-2 duplicates SRV-2; BLD-13 duplicates SRV-6.
- BLD-7: two lockfiles.
- MCP-20: duplicated store bootstrap.
- MCP-22: SSE sessions are per process.
- MCP-23: double broadcast.
- UI-1 duplicates DATA-1.
- UI-22 duplicates SRV-4.

### Findings from this review, now registered

1. **DATA-21: live sync stops for good after a short server outage.** The socket.io client is created with `reconnectionAttempts: 3` (`ProjectContext.tsx:127-131`) and nothing handles the manager's give-up (`reconnect_failed`). After three failed attempts the tab never receives `sync_data` again until it is reloaded. Saves still go out over HTTP, so every edit in that stale tab overwrites the server's newer copy of the whole project (feeds DATA-4). If the reconnect succeeds within the window, the server's on-connect `sync_data` (`server.ts:75`) does refresh the tab. Confirmed by reading; the exact give-up time depends on socket.io-client's back-off defaults and was not measured.
2. **SRV-13: a `data.json` that parses but is not an object crashes startup.** Ran: a file containing `null` makes `server.ts` log "Failed to parse data.json" and then exit with `TypeError: Cannot read properties of null (reading 'projects')` at `server.ts:37`. Contrast DATA-2, where a syntax error is only logged and the store is re-seeded. (Line 29 throws inside the `try` and is caught, but `db` is already `null`.) `stdio.ts:11-21` has the same pattern (by reading). It is fixed by the store rewrite for DATA-2 (backlog P1.5).
