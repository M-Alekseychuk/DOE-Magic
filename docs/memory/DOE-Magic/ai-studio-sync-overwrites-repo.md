# DOE-Magic — Lesson: AI Studio sync overwrites the repo

> Created: 2026-10-20. Status: open risk until the AI Studio project is re-imported from `main` after this PR merges. The rule is in the README warning, AGENTS.md and the design spec.
> Related: [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [README](../../../README.md), [AGENTS.md](../../../AGENTS.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Patch scripts in the repo root](patch-scripts-in-repo-root.md), [Runtime data in git](runtime-data-in-git.md), [Lockfile drift](lockfile-drift.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md) (BLD-4, BLD-7)

## Symptom

The first AI Studio push, ef15736, came on 2026-10-19, 68 seconds after the repo was created. It deleted `README.md`, the only file in the initial commit cb54279. It added 254 files, among them:

- 201 scratch files;
- the runtime `data.json`;
- two lockfiles;
- AI Studio's agent plan under `.aistudio/`.

Its message ("chore: configure project environment and dependencies") hints at none of this. The agent plan was later deleted by hand on GitHub (0d05f8c). Since ea8091e (anchored in bd786d9), `.gitignore` ignores `/.aistudio/`. That only keeps it out of commits made with git. AI Studio's sync may ignore `.gitignore`: in ef15736 it committed `assets/.aistudio/.gitignore`, a file that ignores itself ([AI Studio origin §2](../../context/DOE-Magic/ai-studio-origin.md#2-what-the-ai-studio-export-ef15736-contained)). So a sync may still re-add `.aistudio/` or `data.json`.

## Root cause

- AI Studio's GitHub sync makes the repo match the AI Studio workspace. Files missing from the workspace are deleted from the repo. Everything in the workspace is added, apparently except ignored folders such as `node_modules/` and `dist/`.
- It does not merge with commits made outside AI Studio. In this repo, it committed directly to `main`.
- Nobody reviewed the commit.

This behaviour is inferred from ef15736, not from AI Studio documentation.

The projects themselves do not move with the code. `data.json` is untracked since 64eed78, so a new or re-imported AI Studio workspace has none, and its server seeds only the demo project. The browser's cached copy is overwritten by the server's data on load (`src/web/state/ProjectContext.tsx:82-95`, `:134-142`), so it is not a backup.

This branch changes `main` a lot outside AI Studio: `src/` is reorganised, 201 files are deleted, and `docs/` and `scripts/` are added. The existing AI Studio workspace still has the old layout, so its next sync would undo all of that. The list of effects is in [AI Studio origin §6](../../context/DOE-Magic/ai-studio-origin.md#6-sync-overwrite-risk-and-the-safe-workflow-after-this-pr).

## Fix

- The README opens with a warning (`README.md:5-11`), and AGENTS.md lists the AI Studio rules.
- Owner decision: before switching, every real project is exported with **Export JSON**; after this PR merges, the AI Studio project is re-imported or started fresh from `main` before any further AI Studio edit, and the projects are brought back with **Import Project** on the Dashboard. The exact AI Studio steps are unverified.
- Partial detection:
  - `npm run check` fails R1 if old folders such as `src/components/` reappear, R8 if an entry point disappears, and R9 (since ea8091e) if the scratch files or any other unlisted entry come back at the repo root.
  - Since 03f1ba0, a tracked `.aistudio/` or `data.json` fails R9 with its own message: "re-added by an AI Studio sync; remove it from git with `git rm -r --cached` (it is in .gitignore)".
  - `.gitignore` ignores `/.aistudio/` (ea8091e, anchored in bd786d9) and `data.json` (64eed78), but that only affects commits made with git, not AI Studio's sync.
  - This works only if someone runs it, and a stale push may delete the checker too. CI (BLD-4) would make it automatic.
- Recovery: AI Studio adds ordinary commits (ef15736's parent is cb54279; no force-push is visible). `git revert <sync commit>` restores `main`; real edits inside that commit must be re-applied by hand.

## Rule

Never push from an AI Studio workspace that is older than `main`. After anything lands on `main` outside AI Studio, re-import into AI Studio before editing there again. That includes every merged PR.

Never switch AI Studio workspaces without exporting the data first. Click **Export JSON** on every real project before you leave the old workspace, and bring them back with **Import Project** in the new one.

**How to apply:**

- Before editing in AI Studio, check whether `main` has commits that did not come from this workspace. If it does, export every real project as JSON, then re-import.
- After every AI Studio push, open the commit on GitHub and read its file list. Stop and repair if any of these appear:
  - deleted files;
  - new root files;
  - `package.json` changed without the lockfiles.
- Then run `npm ci && npm run check && npm run build` on the pushed commit. If R9 reports `.aistudio/` or `data.json` as "re-added by an AI Studio sync", run `git rm -r --cached` on it and commit.
- If AI Studio editing is not needed, stop syncing and work through git branches and PRs instead.
