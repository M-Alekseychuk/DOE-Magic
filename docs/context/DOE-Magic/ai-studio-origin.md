# DOE-Magic — AI Studio Origin

> Created: 2026-10-20. Status: describes the repo's history and its AI Studio coupling as of branch `chore/project-structure-and-core-docs` (commits through 534ec68, followed by the docs commit). AI Studio behaviour is inferred from the repo, not from AI Studio documentation; anything not checked is marked "unverified".
> Related: [README](../../../README.md), [AGENTS.md](../../../AGENTS.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Goals](../../task/DOE-Magic/goals.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Server and persistence](server-and-persistence.md), [Web UI](web-ui.md), [Lesson: AI Studio sync overwrites the repo](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md), [Lesson: patch scripts in the repo root](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)

DOE Magic was built in Google AI Studio's app builder ("Build", aistudio.google.com/apps) by M-Alekseychuk, who prompted AI Studio's coding agent and has no software background. The GitHub repo is an export of that AI Studio workspace. This page covers what the export contained, what the code assumes about AI Studio, and how to keep AI Studio and git from overwriting each other.

## 1. Timeline

| When | Commit | What happened | Evidence |
|---|---|---|---|
| by 2026-09-09 | none in this repo | The app was already being built in AI Studio. | `diff.txt` (removed in b8dc9f6) is a `git show` of commit `3862f44` "backup", author "Test", 2026-09-09, which adds an 1,815-line `ProjectAnalysis.tsx`. That commit is not in this repo, so it probably came from AI Studio's own workspace history (unverified). |
| 2026-10-17 | none | AI Studio's agent wrote a plan for en/zh localisation (§3). | `updatedAt` 2026-10-17T13:47:34Z in the plan's `.metadata.json`. |
| 2026-10-19 17:03 (+0200) | cb54279 "Initial commit" | Repo created with AI Studio's 11-line template README ("Built with AI Studio", link to aistudio.google.com/apps). | Committer is "GitHub", so the repo was created through GitHub rather than a local git. |
| 2026-10-19 17:04 | ef15736 "chore: configure project environment and dependencies" | First AI Studio push, 68 s later: 254 files added, `README.md` deleted (§2). The message describes only configuration changes. | `git show --stat ef15736` |
| 2026-10-19 21:01 and 21:22 | 1c67055, e3503e1 | Small follow-up pushes: teal palette and `color-scheme` (3 files); dynamic sample timestamps and MCP modal footer (2 files). Same author and message style, so probably AI Studio syncs (unverified). | |
| 2026-10-20 08:47 | 0d05f8c | `.aistudio/artifacts/brain/7528599c-…/` (the plan) deleted by hand on GitHub. | Committer "GitHub"; GitHub's default "Delete … directory" message. |
| 2026-10-20 | b8dc9f6 … 534ec68, then the docs commit | This branch: cleanup, reorganisation, checks and docs (§7). | |

## 2. What the AI Studio export (ef15736) contained

| Group | Files in ef15736 | Now |
|---|---|---|
| App source | 37 files under `src/`, old layout (`components/`, `pages/`, `utils/`, `context/`, `data/`, `i18n/`, `mcp/`) | Moved into `src/core`, `src/server` and `src/web` by 95fce20; the unreferenced `jiuzhou_logo_*.jpg` was deleted |
| Root config and entries | `server.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `metadata.json`, `.env.example`, `.gitignore` | Kept in place (§5). `tsconfig.json` got `include`/`exclude` (95fce20); `.gitignore` got `data.json` (64eed78) |
| Static files | `public/logo.png`, `public/plotly.min.js` (Plotly 3.7.0, loaded by `index.html:8`) | Kept |
| AI Studio scaffolding | `assets/.aistudio/.gitignore` (contains `*`) | Kept. Purpose unknown; harmless. The root `.gitignore` pattern `/.aistudio/` is anchored to the repo root, so it does not touch this folder |
| Agent artifacts | `.aistudio/artifacts/brain/7528599c-…/implementation_plan.md` and `.metadata.json` | Deleted upstream in 0d05f8c. `.gitignore` ignores `/.aistudio/` since ea8091e (anchored in bd786d9). That only keeps it out of commits made with git; if a sync re-adds it, `npm run check` fails R9 with a "re-added by an AI Studio sync" message (03f1ba0) |
| Runtime store | `data.json` (the Suzuki demo project, 27 runs, one folder) | Untracked and gitignored (64eed78). R9 reports it if a sync commits it again (03f1ba0) |
| Lockfiles | `bun.lock` (matched `package.json`) and `package-lock.json` (did not) | `package-lock.json` synced (50c088c); both kept until BLD-7 is decided |
| Scratch | 195 one-off scripts, 4 text dumps, 2 HTML mock-ups | Removed (b8dc9f6) |
| `README.md` | Deleted (it held the AI Studio template text) | New README written on this branch |

What this says about the exporter:

- It deleted `README.md`, which existed only on GitHub. A push makes the repo match the workspace; it does not merge in changes made elsewhere.
- It exported no `node_modules/` or `dist/`, which suggests it skips gitignored paths. But it did export `assets/.aistudio/.gitignore`, which plain git ignores because the file's own `*` matches it (`git check-ignore -v --no-index` reports `assets/.aistudio/.gitignore:1:*`). Its ignore handling therefore differs from git's, and it may ignore `.gitignore` altogether. `.gitignore` only keeps files out of commits made with git; whether a gitignored `data.json` or `.aistudio/` stays out of future AI Studio pushes is unverified. Since 03f1ba0, R9 fails with a specific message ("re-added by an AI Studio sync; remove it from git with `git rm -r --cached`") when either is tracked again.

Other traces of the AI Studio workflow:

- `lint_output.txt` (removed) holds `sh: 1: tsc: not found`. The agent ran `npm run lint` in a shell where TypeScript was not installed.
- The plan's test step says "Run `compile_applet`", which is an AI Studio agent tool.
- The page title is "Remix DOE Magic V.1.5.2 (current Version)" (`index.html:6`, `:10`). "Remix" may mean the app was copied from an earlier AI Studio app (unverified). `metadata.json:2` has the same name without "Remix".

## 3. The deleted localisation plan (2026-10-17)

The plan was titled "Multi-Language Localization System (English & Simplified Chinese)". It set these goals:

- English and Simplified Chinese (zh-CN) everywhere: every view, statistics label, tooltip, the guide and the exports.
- Audience: pharmaceutical research and process development teams, naming Jiuzhou Pharmaceutical and "global research teams".
- DOE acronyms stay in English (DOE, ANOVA, OLS, R², RMSE, Cpk, DSD, CCD, BBD).
- A custom typed `LanguageContext` / `useTranslation` hook instead of i18next, for zero bundle cost and instant switching.
- Room for German, Spanish, French and Italian later.

It also planned a test pass: compile, live switching, persistence across reloads, no overflow from Chinese text, and exports following the active language.

| Plan | Code now |
|---|---|
| Typed context and hook, no i18next | Built: `src/web/i18n/LanguageContext.tsx:14-68` |
| `t(key, fallback?, params?)` with `{count}` placeholders and English fallback | Built (`LanguageContext.tsx:40-53`). No caller passes `params`, and `\|\|` turns an intentionally empty translation into English (I18N-6) |
| Choice saved in `localStorage` key `app_language`, `<html lang>` kept in sync | Built (`LanguageContext.tsx:16`, `:29`, `:32-36`). With nothing saved, it falls back to the browser language (`:21-23`) |
| Drop-up menu in the sidebar footer next to dark mode, with globe icon, native names and checkmark | Built: `src/web/i18n/LanguageSelector.tsx`, mounted at `src/web/Layout.tsx:149` |
| de/es/fr/it listed as "coming soon" | Not shown. `SUPPORTED_LANGUAGES` lists only en and zh (`src/web/i18n/translations.ts:11-14`); de/es/fr/it are empty dictionaries (`translations.ts:448-451`) (I18N-6) |
| A dictionary grouped by area (common, nav, dashboard, …) used by every view | One flat key map per language. Only 6 files call `t()`; the rest use inline `locale === 'zh'` branches (I18N-1). Most keys are unused (I18N-5) |
| Exports follow the active language | `generateExportHTML` takes `initialLocale` (`src/web/features/export/htmlExport.ts:6`), but `src/web/pages/ProjectView.tsx:356` does not pass it. Excel export is English only (I18N-2) |

## 4. Gemini

- `server.ts:122` says a Gemini integration "for DOE suggestions and optimization" was removed so the app runs locally. The removal predates the export, so the Gemini code is not in this repo's history. Nothing in `src/` or `server.ts` imports `@google/genai`. The app sends no data to Gemini.
- Leftovers:
  - the `@google/genai` dependency (`package.json:15`; BLD-5, SRV-11);
  - `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in `metadata.json:5-7` (BLD-10);
  - `GEMINI_API_KEY` in `.env.example:1-4` (BLD-10);
  - LaTeX clean-up regexes for stored optimisation reports in `src/web/features/optimization/ProjectOptimization.tsx:666-678`. They probably date from LLM-written reports (UI-30; unverified).
- `src/web/features/mcp-panel/McpModal.tsx:218-219` names Gemini only as an example MCP client. That is not a leftover.
- The capability and the key stay until someone checks whether AI Studio needs them (BLD-10).

## 5. What the code assumes about AI Studio

| Assumption | Where | Basis |
|---|---|---|
| One Node process on port 3000, listening on all interfaces | `server.ts:8`, `server.ts:389` | Template convention. That AI Studio's preview expects port 3000 is unverified; AGENTS.md keeps 3000 |
| In development, Vite runs as Express middleware in the same process. The HMR client port is 443 when `K_SERVICE` or `APP_URL` is set (behind the AI Studio or Cloud Run proxy), otherwise 3000 | `server.ts:366-380` (`isCloudRun` at `:368`) | Code |
| AI Studio sets `DISABLE_HMR=true` to stop HMR and file watching while its agent edits | `vite.config.ts:15-21` (comment says "Do not modify") | Template comment. The inline `hmr` object in `server.ts` probably overrides `hmr: false` (SRV-10, unverified). Line 17 holds a mojibake dash (BLD-14) |
| The AI Studio proxy rejects the HMR WebSocket, so those errors are suppressed | `index.html:12-32` | Template comment |
| `GEMINI_API_KEY` comes from AI Studio's Secrets panel; `APP_URL` is the Cloud Run service URL, injected at runtime | `.env.example:1-9` | Template comments |
| Applet manifest: name, description, `requestFramePermissions: []`, `majorCapabilities` | `metadata.json:1-8` | AI Studio file. The meaning of fields other than name and description is unverified |
| Scaffolding folder | `assets/.aistudio/.gitignore` | Unknown purpose; keep |
| Vite entry is `src/main.tsx`, referenced from `index.html:36` | `src/main.tsx` | Template layout. R8 in `npm run check` fails if it disappears |
| Every path resolves from `process.cwd()`, which must be the repo root | `server.ts:9`, `server.ts:382`, `src/server/mcp/stdio.ts:8` | Code (SRV-8) |
| Production means `npm run build`, then `node dist/server.cjs` | `package.json:8-9` | Whether AI Studio's deploy sets `NODE_ENV=production` is unverified (BLD-1, SRV-3) |
| A deployed instance keeps `data.json` on the container's filesystem | `server.ts:9`, `server.ts:368` | Not durable on Cloud Run (DATA-9). How the app is actually deployed is unverified |

AGENTS.md lists the files and settings that must not move for this reason.

## 6. Sync-overwrite risk and the safe workflow after this PR

A sync makes the repo match the AI Studio workspace (§2). The existing AI Studio workspace predates this branch. If it pushes after this PR merges, ef15736's behaviour suggests the push would do the following (not tested for this case):

- Delete `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/`, `scripts/check-boundaries.mjs` and the `check` script in `package.json`.
- Recreate `src/components/`, `src/pages/`, `src/utils/` and the other old folders, and delete `src/core/`, `src/server/` and `src/web/`.
- Re-add the 201 scratch files and `data.json`, if they are still in the workspace. No later AI Studio commit removed them, so they were there as of e3503e1. `.gitignore` does not stop AI Studio's sync from re-adding `data.json`; R9 reports it.
- Re-add the agent plan under `.aistudio/`. `.gitignore` ignores `/.aistudio/` since ea8091e, but that only applies to commits made with git; AI Studio's export may not honour it (§2). R9 reports a tracked `.aistudio/` with its AI Studio message.
- Restore the old `package-lock.json`, `tsconfig.json` and `index.css` (without `source("..")`).
- Mix any new AI Studio edits into that same commit.

AI Studio added ordinary commits here: ef15736's parent is cb54279, and no force-push is visible. So `git revert` of the sync commit would restore `main`, but real edits inside that commit would have to be re-applied by hand.

Your projects do not travel with the code. A new or re-imported AI Studio workspace has no `data.json` (it is untracked since 64eed78), so the server seeds only the demo project. The browser's cached copy is not a backup either: it is overwritten by the server's data on every load (`src/web/state/ProjectContext.tsx:82-95`, `:134-142`). So, before switching workspaces, open every real project in the current app and click **Export JSON** on its page, and keep the files. In the new workspace, bring each one back with **Import Project** on the Dashboard (it is imported as a copy).

Pick one way of working after the merge:

| Option | Steps |
|---|---|
| A. Keep editing in AI Studio | 1. Stop editing and syncing in the old AI Studio app, and export every real project with **Export JSON**. 2. Merge this PR. 3. Start an AI Studio project from current `main`, by re-importing the repo or by starting a fresh app with `main`'s files (the exact AI Studio steps are unverified), then bring the projects back with **Import Project** on the Dashboard. 4. Make one trivial change, push it, and check on GitHub that the commit touches only that file. 5. After every push, read the commit's file list (look for deletions, new root files, or `package.json` changed without the lockfiles), then run `npm ci && npm run check && npm run build`. Do this locally until CI exists (BLD-4). 6. Whenever `main` changes outside AI Studio (any merged PR), export the projects again and re-import before the next AI Studio edit. |
| B. Stop syncing from AI Studio | Work through git: clone to a short path ([windows-long-paths](../../memory/DOE-Magic/windows-long-paths.md)), make a branch, edit by hand or with an AI coding assistant that reads AGENTS.md, run `npm run check` and `npm run build`, and open a PR. AI Studio can still be used to try ideas, but its changes are copied into the repo by hand, never pushed by its sync. |

Signs that a push came from a stale workspace:

- `README.md`, `docs/` or `scripts/` is deleted.
- New folders appear at the top of `src/`. `npm run check` fails R1 if the checker survived; `npm run check` reports a missing script if it did not.
- 200 new files appear in the repo root. `npm run check` fails R9 on any tracked root entry outside the agreed list, if the checker survived.
- `.aistudio/` or `data.json` is tracked again. `npm run check` fails R9 with "re-added by an AI Studio sync; remove it from git with `git rm -r --cached`".

In this repo every AI Studio commit landed directly on `main`. Whether AI Studio can push to a branch instead is unverified.

## 7. Cleanup done on this branch

| Commit | Change | Lesson or spec |
|---|---|---|
| b8dc9f6 | Removed 195 dead scripts, 4 dumps and 2 mock-ups from the root (201 files) | [patch-scripts-in-repo-root](../../memory/DOE-Magic/patch-scripts-in-repo-root.md) |
| 64eed78 | Stopped tracking `data.json` and gitignored it | [runtime-data-in-git](../../memory/DOE-Magic/runtime-data-in-git.md) |
| 50c088c | Synced `package-lock.json` with `package.json`; `bun.lock` already matched | [lockfile-drift](../../memory/DOE-Magic/lockfile-drift.md) |
| 95fce20 | Moved `src/` into `core/`, `server/` and `web/`: 34 renames with import-path edits only. Deleted an unreferenced JPG and gave `tsconfig.json` `include`/`exclude` | [Design spec](../../spec/DOE-Magic/design-spec.md) |
| 818b8db | Limited Tailwind scanning to `src/` | [tailwind-scans-whole-repo](../../memory/DOE-Magic/tailwind-scans-whole-repo.md) |
| 2a55744 | Added `npm run check` and `scripts/check-boundaries.mjs` with the layer rules (R1 to R8) | [Design spec](../../spec/DOE-Magic/design-spec.md) |
| ea8091e | Added rule R9 (repo-root allowlist) to `scripts/check-boundaries.mjs`, so the check now enforces R1–R9; `.gitignore` now ignores `.aistudio/` | [Design spec](../../spec/DOE-Magic/design-spec.md), [patch-scripts-in-repo-root](../../memory/DOE-Magic/patch-scripts-in-repo-root.md) |
| bd786d9 | Anchored the ignore to the root (`/.aistudio/`) so it leaves the template's `assets/.aistudio/` alone | |
| 03f1ba0 | Rewrote the checker on the TypeScript compiler API (it now needs `node_modules`): imports are read with `ts.preProcessFile` and browser globals are found on the syntax tree, so comments and strings no longer count; `src/main.tsx` counts as browser code and `server.ts` as server code; `.js`/`.jsx`/`.mjs`/`.cjs` files are scanned; loose files in `src/web/features/` fail R6; R1 ignores dotfiles; R9 allows `.github/` and `LICENSE` and reports a tracked `.aistudio/` or `data.json` as re-added by an AI Studio sync | [Design spec](../../spec/DOE-Magic/design-spec.md) |
| 534ec68 | Added the checker self-test `scripts/check-boundaries.test.mjs` (28 cases) | [Design spec](../../spec/DOE-Magic/design-spec.md) |
| the docs commit | `README.md`, `AGENTS.md`, `CLAUDE.md` and `docs/` | [AI Studio sync lesson](../../memory/DOE-Magic/ai-studio-sync-overwrites-repo.md) |

Verification:

- `tsc --noEmit` is clean before and after.
- The main JS bundle is 2,002,786 B in both the pre-change and post-change builds.
- 95fce20 records identical smoke-test results for the production server, MCP over HTTP and stdio MCP.
- The checker's self-test (`node scripts/check-boundaries.test.mjs`, 534ec68) passes all 28 cases. In 21 of them an injected violation covering R1–R9 makes the check fail; in the other 7, a former false positive passes. The clean tree passes.

These were left alone on purpose, for AI Studio:

- every root file in §5;
- the `DISABLE_HMR` block;
- port 3000;
- `bun.lock`;
- the Gemini capability and key;
- the `@google/genai` dependency (removing it is BLD-5).

## 8. Open questions (unverified)

- Which installer AI Studio uses (bun or npm). This decides which lockfile to keep (BLD-7).
- Whether AI Studio needs `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` or `GEMINI_API_KEY` (BLD-10).
- Whether AI Studio's deploy sets `NODE_ENV=production` (BLD-1, SRV-3).
- Whether AI Studio's export honours `.gitignore`, for example for `data.json` and `.aistudio/`.
- How to re-import an existing GitHub repo into AI Studio, and whether its sync can target a branch.
- Whether and how the app was deployed (DATA-9).
