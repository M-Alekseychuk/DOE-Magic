# DOE-Magic — Lesson: Windows long paths break clone, install and temp working copies

> Created: 2026-10-20. Status: worked around with a short clone path and `core.longpaths`; the rule applies to every Windows checkout, including temporary working copies.
> Related: [README](../../../README.md), [AGENTS.md](../../../AGENTS.md), [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md) (BLD-5)

## Symptom

These failures were reported while this branch was being set up on Windows 11; they were not re-run for this doc:

- `git clone` into a deeply nested workspace folder failed with "Filename too long".
- `npm install` failed in esbuild's postinstall step. That step runs the downloaded `esbuild.exe --version` to check the binary (`node_modules/esbuild/install.js:98-102`), and the executable's full path was longer than 260 characters.

A third instance came up later the same day, while verifying this branch:

- `git init` in a deeply nested temporary directory under `AppData\Local\Temp\claude\...` failed with "Filename too long". Temporary working copies (a scratch clone, a `git worktree`, an extracted baseline) hit the same limit as the main checkout, so they need short paths too.

## Root cause

Many Windows programs still cap a full path at MAX_PATH, which is 260 characters:

- Git for Windows refuses longer paths unless `core.longpaths` is true.
- Starting an executable from a path beyond the limit fails, even though Node can read and write such paths.
- `LongPathsEnabled` is 1 in this machine's registry (checked afterwards), so the OS-wide switch alone did not prevent the failures.

The numbers (relative paths measured in this checkout):

| Path | Length |
|---|---|
| Agent workspace folders on this machine, before the repo's own paths | roughly 150–245 characters |
| Longest files under `node_modules/`: `node_modules/@reduxjs/toolkit/skills/…/listener-workflows.md` (via recharts) and `node_modules/plotly.js/src/generated/regl-codegen/<64 hex>` (via react-plotly.js, BLD-5) | 114 characters |
| `node_modules/tsx/node_modules/@esbuild/win32-x64/esbuild.exe` | 60 characters |
| Longest tracked source path (`src/web/features/optimization/ProjectOptimization.tsx`) | 53 characters |

So when the repo root is longer than about 145 characters, some installed files exceed 260. Past about 200, the nested `esbuild.exe` does too.

## Fix

Clone into a short folder, with long paths enabled for git:

```text
git clone -c core.longpaths=true https://github.com/M-Alekseychuk/DOE-Magic.git D:\resource\githubrepo\DOE-Magic
cd D:\resource\githubrepo\DOE-Magic
npm install
```

That root is 33 characters including the trailing backslash, so the longest file path is about 147 characters. The clone used for this branch has `core.longpaths=true` in `.git/config`.

## Rule

On Windows, keep the repo root short, a few dozen characters such as `D:\resource\githubrepo\DOE-Magic`, and set `core.longpaths=true`. Never clone, `git init`, create a worktree or run `npm install` inside `AppData\Local\Temp`, agent scratch folders or other deeply nested folders. This applies to temporary working copies as much as to the main checkout.

**How to apply:**

- Before cloning or creating any temporary working copy, count the target folder's length. If it is near 100 characters or more, choose a shorter one.
- Clone with `git clone -c core.longpaths=true …`, or run `git config core.longpaths true` in an existing clone.
- If `git` or `npm install` fails with a path or spawn error on Windows, check path length first. Move the repo to a short folder and delete `node_modules/` before reinstalling.
- Removing unused dependencies (BLD-5) shortens some of the deepest paths but is not a substitute: recharts brings in a 114-character path too.
