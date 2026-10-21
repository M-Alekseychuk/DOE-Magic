# DOE-Magic — Lesson: package-lock.json drifted from package.json

> Created: 2026-10-20. Status: the drift was fixed in 50c088c (PR #1). Updated 2026-10-21: commit cc41f15 then deleted both lockfiles, and decision 1 now keeps none ([below](#follow-up-both-lockfiles-deleted-2026-10-21)). The rule at the end is the current one.
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
- Both lockfiles stayed until the AI Studio installer was known (BLD-7).

## Follow-up: both lockfiles deleted (2026-10-21)

**Mistake.** Commit cc41f15 ("build: configure server port and HMR settings", M-Alekseychuk, 2026-10-21) was pushed from AI Studio 13 minutes after PR #1 merged. It deleted `package-lock.json`, `bun.lock` and `assets/.aistudio/.gitignore`, and its message mentions none of them. `npm ci` on `main` then failed for want of a lockfile, and every install floated within the `package.json` ranges. A fresh install on cc41f15 (2026-10-21, npm 11.6.2) resolved Vite 6.4.5, where PR #1's lockfile had 6.4.3. The main bundle came out at 2,033,476 bytes instead of PR #1's 2,002,786, although no client code had changed.

**Root cause.** AI Studio's sync makes the repo match its workspace ([lesson](ai-studio-sync-overwrites-repo.md)). The workspace otherwise matched `main` (the commit touches only 6 files), so either the refresh from `main` did not bring these files over, or AI Studio removed them; which of the two is unverified. Its first export, ef15736, did contain both lockfiles, so AI Studio does not always drop them.

**Decision.** Decision 1 was settled on 2026-10-21 by the developer: **npm with no lockfile for now.** A restored lockfile would be deleted by the next AI Studio push, the owner is still learning and keeps pushing from AI Studio, and early development accepts floating versions. Both files are in `.gitignore`. R9 still allows them, so a sync that brings one back does not fail `npm run check`.

**The cost, accepted for now.** Two installs on different days can resolve different versions. A test or a computed number can change after `npm install` with no code change. `npm ci` cannot run, and `npm audit` reports on whatever was installed that day.

**Revisit when** any of these happens. Then commit one `package-lock.json`, remove it from `.gitignore`, and switch CI to `npm ci`:
- the owner stops pushing to `main` from AI Studio (decision 4);
- a dependency update changes a test result or breaks the build;
- decision 6 makes the tool GMP-relevant, where reproducible builds are expected.

## Rule

No lockfile is tracked (decision 1). A dependency change is `package.json` only, made by npm. Installs float, so before suspecting the code, rule out a dependency update.

**How to apply:**

- Change dependencies with `npm install <pkg>` or `npm uninstall <pkg>`; never edit `package.json` alone.
- Commit `package.json` only. npm writes a local `package-lock.json`; `.gitignore` keeps it out of git. Do not restore or commit a lockfile unless decision 1 is reopened.
- Install with `npm install`; `npm ci` needs a lockfile. CI does the same (P2.1 step 2) and prints the versions the tests depend on.
- When a check fails after a fresh install and the code did not change, compare `npm ls <pkg>` with the last good run.
- After every AI Studio push, read the commit's file list. A deletion that the message does not mention comes from the sync, not from a decision.
- If a sync brings a lockfile back, untrack it with `git rm --cached package-lock.json` (or `bun.lock`).
- `packageManager` and `engines` in `package.json` are still to do (BLD-7, P2.2).
