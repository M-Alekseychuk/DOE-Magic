# DOE-Magic — Agent Index

PRIVATE repo. DOE Magic is a Design-of-Experiments web app for pharmaceutical process development (Jiuzhou Pharmaceutical). It is a React + Vite front end and an Express server with socket.io and a JSON-file store. A pure-TypeScript statistics and design engine is shared by the browser and Node, and an MCP server exposes it to AI clients. It was built in Google AI Studio by a non-developer. Docs are in English.

> **Start here:** read [`docs/task/DOE-Magic/status-and-handoff.md`](docs/task/DOE-Magic/status-and-handoff.md) for the current state, the critical known issues and the next steps. Then read [`docs/spec/DOE-Magic/roadmap-backlog.md`](docs/spec/DOE-Magic/roadmap-backlog.md) for the prioritised work, and [`docs/spec/DOE-Magic/design-spec.md`](docs/spec/DOE-Magic/design-spec.md) for the architecture contract.

## Layout and layer rules

```text
server.ts            Node entry: Express REST + socket.io + MCP over HTTP + Vite/static serving
index.html           browser entry → src/main.tsx
src/main.tsx         Vite entry (stays here: AI Studio template location)
src/core/            PURE TS, browser + Node: types, sampleProject, analysis/, design/
src/server/          NODE ONLY: mcp/ (doeMcpServer, stdio entry for `npm run mcp`)
src/web/             BROWSER ONLY: App, Layout, state/, i18n/, shared/, pages/, features/<tab>/
scripts/             real tooling only (check-boundaries.mjs)
docs/{task,spec,context,memory}/DOE-Magic/   project docs (WF convention)
```

`npm run check` runs `tsc --noEmit` and `scripts/check-boundaries.mjs`. It must pass. The rules:

- **R1** `src/` holds only `main.tsx`, `vite-env.d.ts`, `core/`, `server/` and `web/`. Dotfiles such as `.DS_Store` are ignored.
- **R2** Imports between project files are relative. `@/` and `src/` specifiers are rejected. `@/` points at the repo root rather than `src/`, and the check cannot place an aliased import in a layer.
- **R3** `src/core` is plain TypeScript, with no `.tsx` or `.jsx`. It imports only `src/core` and the `jstat` and `uuid` packages, and never reads browser globals (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`).
- **R4** Server code (`src/server` and `server.ts`) imports project files only from `src/core` and `src/server`. npm packages are allowed, except React.
- **R5** Browser code (`src/web` and `src/main.tsx`) never imports `src/server`. It talks to the server over HTTP and socket.io.
- **R6** `src/web/features/<a>` never imports `src/web/features/<b>`, and no loose files sit directly in `src/web/features/`. Put shared UI in `src/web/shared/` and shared logic in `src/core/`.
- **R7** Everything reachable from `server.ts` and the stdio MCP entry is in `src/core` or `src/server`.
- **R8** The entry points exist: the `index.html` module script, the `npm run mcp` target and `server.ts`.
- **R9** Git tracks only these entries at the repo root: `.env.example`, `.github/`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `README.md`, `assets/`, `bun.lock`, `docs/`, `index.html`, `metadata.json`, `package-lock.json`, `package.json`, `public/`, `scripts/`, `server.ts`, `src/`, `tsconfig.json` and `vite.config.ts`. A tracked `.aistudio/` or `data.json` (re-added by an AI Studio sync) fails with its own message. `bun.lock` and `package-lock.json` are allowed but not tracked (decision 1), so a sync that brings one back does not fail the check. To add a root entry, update this list and the one in `scripts/check-boundaries.mjs`.

The check reads imports with the TypeScript compiler API, so commented-out code and import-like strings do not count.

Where new code goes:

| New code | Location |
|---|---|
| A statistic | `src/core/analysis/` |
| A design type | `src/core/design/` |
| A new tab | `src/web/features/<tab>/` |
| UI used by two features | `src/web/shared/` |
| An MCP tool | `src/server/mcp/`, and it calls `src/core` |

Never put a calculation only in a component or only in the MCP server.

## Commands

`npm install` (no lockfile, so never `npm ci`) · `npm run dev` (http://localhost:3000; `PORT` picks another port, but hot reload then breaks, SRV-14) · `npm run check` · `npm run build` (`dist/` + `dist/server.cjs`) · `npm start` with `NODE_ENV=production` (bash: `NODE_ENV=production npm start`; PowerShell: `$env:NODE_ENV="production"; npm start`, then `Remove-Item Env:NODE_ENV`) · `npm run mcp` (stdio MCP)

The production bundle needs Node 22.12+ (or 20.19+), because it `require()`s the ESM-only `uuid` package.

Before you finish any change, run `npm run check` and `npm run build`.

## Rules that matter here

- **Keep Google AI Studio working.**
  - Do not move or rename `server.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `metadata.json`, `.env.example`, `public/` or `src/main.tsx`. The same goes for `assets/.aistudio/` if the owner restores it; cc41f15 deleted its only file.
  - Do not touch the `DISABLE_HMR` block in `vite.config.ts`.
  - Paths resolve from `process.cwd()`, which is the repo root. The default port is 3000; since cc41f15 `PORT` overrides it. Keep the default.
- **No lockfile for now** (decision 1, settled 2026-10-21). Do not commit or restore `package-lock.json` or `bun.lock`; both are in `.gitignore`. Change dependencies with `npm install <pkg>` or `npm uninstall <pkg>` and commit `package.json` only. See [the lesson](docs/memory/DOE-Magic/lockfile-drift.md).
- **One PR is either a move or a logic change, never both.** File moves and import-path edits go in their own commit or PR, so git rename detection and `git log --follow` keep working.
- **Write contract changes into the docs before you implement them.** That covers statistical semantics (model terms, p-values, desirability), the persisted data format (`src/core/types.ts`, `data.json`, localStorage keys) and MCP tool inputs and outputs.
- **Statistics changes need a reference test.** Compare against JMP, R or a published example. Many numbers shown today are wrong; see the critical issues in the status doc. Never "fix" a number without a test that pins the correct value.
- **One implementation per calculation, in `src/core`.** Duplicates have already drifted apart: two design generators, three desirability formulas and two Monte Carlo loops. Consolidate them; do not add another copy.
- **Never commit scratch, patch or debug scripts to the repo.** Edit source files directly and keep throwaway scripts outside the repo. 201 of them had piled up at the root; see [the lesson](docs/memory/DOE-Magic/patch-scripts-in-repo-root.md).
- **User-visible text goes through `t()`** (`src/web/i18n/`) with both English and Chinese. Keep DOE terms in English: DOE, ANOVA, OLS, R², RMSE, Cpk, DSD, CCD, BBD.
- **Tailwind scans only `src/`** (`source("..")` in `src/web/index.css`). Never rely on a class that appears only outside `src/`.
- **Keep it private.** Never make the repo or its data public, and never push to other accounts.

## Docs (WF convention)

- `docs/task/DOE-Magic/`: goals and the START HERE status/handoff.
- `docs/spec/DOE-Magic/`: executable specs, meaning the architecture contract and the backlog with issue IDs (`STAT-n`, `DES-n`, `MCP-n`, `SRV-n`, `DATA-n`, `UI-n`, `I18N-n`, `BLD-n`).
- `docs/context/DOE-Magic/`: how each subsystem works today.
- `docs/memory/DOE-Magic/`: lessons, written as mistake → root cause → prevention. Check them before repeating a pattern.

When you change behaviour, update the doc that describes it in the same PR.
