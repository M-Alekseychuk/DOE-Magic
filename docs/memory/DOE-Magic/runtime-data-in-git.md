# DOE-Magic — Lesson: Runtime data was tracked in git

> Created: 2026-10-20. Status: fixed on this branch (64eed78); the store's own weaknesses are backlog (DATA-2, DATA-9, DATA-12, SRV-8).
> Related: [Server and persistence](../../context/DOE-Magic/server-and-persistence.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [AI Studio sync overwrites the repo](ai-studio-sync-overwrites-repo.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md)

## Symptom

The AI Studio export ef15736 committed `data.json`: 504 lines holding the Suzuki demo project (27 runs) and one folder. That file is the server's live database:

- `saveData()` (`server.ts:62-68`) rewrites the whole file and is called from 11 places in the REST, socket.io and MCP handlers (`server.ts:85-223`).
- Many fields save on every keystroke (DATA-8).
- The stdio MCP server writes the same file (`src/server/mcp/stdio.ts:32-38`).

As a result:

- Starting the app and clicking around dirtied the working tree at once, so `git add -A` would commit test edits.
- Real experiment data, which is proprietary process data, could be committed and pushed.
- An AI Studio push could carry the AI Studio container's copy of `data.json` over the repo's copy.

## Root cause

- The template `.gitignore` (`node_modules/`, `build/`, `dist/`, `coverage/`, `.DS_Store`, `*.log`, `.env*`) did not list the store.
- The store lives in the folder the server is started from (`path.join(process.cwd(), 'data.json')`, `server.ts:9`), which is normally the repo root, not in a data folder (SRV-8).
- Seed data and live data share one file name.
- AI Studio's export commits whatever is in the workspace. Whether it honours `.gitignore` is unverified: it committed `assets/.aistudio/.gitignore`, a file that ignores itself ([AI Studio origin §2](../../context/DOE-Magic/ai-studio-origin.md#2-what-the-ai-studio-export-ef15736-contained)).

## Fix

- 64eed78 untracked `data.json` (`git rm --cached`) and added it to `.gitignore` with a comment naming its writers (`.gitignore:10-11`).
- Nothing was lost. When the file is missing, `server.ts` seeds it from `src/core/sampleProject.ts` (`server.ts:37-56`), and so does stdio (`stdio.ts:21-27`). Seed data stays in source; live data stays on the machine.
- `.gitignore` only keeps `data.json` out of commits made with git. If an AI Studio sync commits it again, `npm run check` fails R9 with "re-added by an AI Studio sync; remove it from git with `git rm -r --cached`" (03f1ba0).
- Because the file is untracked, a new or re-imported AI Studio workspace starts with only the demo project. Export every real project with **Export JSON** before switching, and bring it back with **Import Project** ([AI Studio sync lesson](ai-studio-sync-overwrites-repo.md)).
- Follow-ups in the backlog:
  - a configurable data path (SRV-8);
  - atomic writes and backups (DATA-2);
  - a versioned schema (DATA-12);
  - durable storage when deployed (DATA-9).
- A local build snapshot (`.baseline-dist/`) was untracked but not ignored (BLD-14), the same kind of risk. It has since been deleted, and rule R9 of `npm run check` (ea8091e) now fails if an unlisted entry such as that folder is committed at the repo root.

## Rule

Never track files the app writes at runtime: stores, caches, logs or build output. Seed and fixture data live in source (`src/core/sampleProject.ts`) and are copied at start-up.

**How to apply:**

- After running the app, run `git status`. Any file that changed without you editing it is runtime output.
- Add such a file to `.gitignore` with a comment naming the code that writes it, and run `git rm --cached` on it if it is tracked.
- A new feature that persists data must write under an ignored path.
- Before committing, check `git diff --cached --stat` for `data.json` or other data files.
