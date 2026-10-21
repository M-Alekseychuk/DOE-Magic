# DOE-Magic — Lesson: package-lock.json drifted from package.json

> Created: 2026-10-20. Status: fixed on this branch (50c088c). Which single lockfile to keep is still open (BLD-7).
> Related: [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md) (BLD-7, BLD-4, BLD-5), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md)

## Symptom

On `origin/main` (0d05f8c), `npm ci` refused to install. Re-running it for this doc (npm 11.6.2, `npm ci --dry-run` on 0d05f8c's `package.json` and `package-lock.json`) gives:

```text
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Missing: @modelcontextprotocol/sdk@1.32.1 from lock file
npm error Missing: remark-gfm@4.0.1 from lock file
npm error Missing: zod@4.6.7 from lock file
npm error Missing: @hono/node-server@2.1.5 from lock file
…
```

In total npm prints 67 "Missing" lines (the three packages plus their transitive dependencies) and one "Invalid" line (`proxy-addr@2.0.7` in the lockfile vs 2.0.8 required).

The lockfile also still listed `pptxgenjs`, which `package.json` no longer had. A plain `npm install` does not fail; it quietly rewrites `package-lock.json`, so day-to-day use hid the drift.

## Root cause

- The AI Studio export (ef15736) committed both `bun.lock` and `package-lock.json`.
- Dependencies were added (`@modelcontextprotocol/sdk` and `zod` for the MCP server, `remark-gfm` for GitHub-flavoured Markdown in the optimisation report, `src/web/features/optimization/ProjectOptimization.tsx:5`) and `pptxgenjs` was removed, with a tool that updated `bun.lock` but not `package-lock.json`. `bun.lock` matched `package.json` exactly.
- Which installer AI Studio uses is unknown. The up-to-date `bun.lock` points to bun (unverified).
- No check ran `npm ci`, and `package.json` declares no `packageManager`.

## Fix

- 50c088c regenerated `package-lock.json` with `npm install` (+1,219 / −509 lines). `npm ci --dry-run` now succeeds (688 packages).
- `bun.lock` already matched and was not touched. Later commits on this branch changed only `package.json` scripts, which lockfiles do not record.
- Both lockfiles stay until the AI Studio installer is known (BLD-7).

## Rule

A dependency change means `package.json` and the lockfiles, in the same commit. Checks install with `npm ci`, never `npm install`. While two lockfiles exist, keep both in sync.

**How to apply:**

- Change dependencies with `npm install <pkg>` or `npm uninstall <pkg>`; never edit `package.json` alone.
- Then run `bun install` if bun is available, so `bun.lock` follows. If bun is not available, say so in the PR.
- Commit `package.json`, `package-lock.json` and `bun.lock` together.
- Before merging, run `npm ci` (or `npm ci --dry-run`) on a clean checkout. It fails on drift.
- After every AI Studio push, check whether `package.json` changed without `package-lock.json`.
- CI should run `npm ci` (BLD-4).
- Once one lockfile is chosen, delete the other and add `packageManager` and `engines` to `package.json` (BLD-7).
