# DOE-Magic — Lesson: Patch scripts piled up in the repo root

> Created: 2026-10-20. Status: fixed on this branch (b8dc9f6); the rule is in AGENTS.md and the design spec, and `npm run check` enforces it with rule R9 since ea8091e.
> Related: [AI Studio origin](../../context/DOE-Magic/ai-studio-origin.md), [AI Studio sync overwrites the repo](ai-studio-sync-overwrites-repo.md), [Tailwind scans the whole repo](tailwind-scans-whole-repo.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md) (BLD-4), [AGENTS.md](../../../AGENTS.md)

## Symptom

The repo root held 201 files that nothing used. All of them came in with the AI Studio export ef15736:

- 195 scripts (145 `.mjs`, 22 `.js`, 20 `.cjs`, 5 `.py`, 3 `.tsx`);
- 4 text dumps: `analysis.txt` and `temp1.txt` (old partial copies of `ProjectAnalysis.tsx`), `diff.txt` (a `git show` from AI Studio's sandbox) and `lint_output.txt`;
- 2 HTML mock-ups: `test-dropdown.html` and `test-logo.html`.

| Kind | What they did | Examples |
|---|---|---|
| Source patchers | Read a file under `src/`, find-and-replace or rewrite a block, write it back. 122 scripts write into `src/`; about 80 of them target `ProjectAnalysis.tsx` | `fix_*`, `patch_*`, `update*`, `modify*`, `rewrite_robustness.cjs`, `extract_analysis.cjs` |
| Inspectors | Print regex matches or fixed line ranges of `ProjectAnalysis.tsx` | `get-*`, `check*`, `debug-syntax.mjs` (`lines.slice(1230, 1250)`) |
| Numeric scratch | Copies of the statistics code that print results | `test-ols.mjs`, `test-lof.js`, `test-anova*.js`, `test-full-gp.mjs` |
| Stubs | One-line no-ops | `wait.mjs`, `wait-lint.mjs`, `test.js` |

Consequences:

- **Dangerous to re-run.** `fix_html_full.mjs`, `fix_html_full.py` and `make_export.mjs` each write a complete, older `htmlExport.ts` over the current one, which is 1,479 lines and includes the logo and Chinese locale. Debug patchers would put `console.log` calls back.
- **Noise in the tools.** `tsc` swept the scripts, because `tsconfig.json` had `allowJs: true` and no `include`. Tailwind scanned them into the CSS ([Tailwind lesson](tailwind-scans-whole-repo.md)).
- **No way to tell tooling from junk.** The few numeric checks worth keeping never became tests.

## Root cause

- AI Studio's coding agent edited code by writing a throwaway script that patched a source file, running it, and leaving it in the workspace. It inspected code the same way. This is inferred from the scripts themselves; for example, `fix2.mjs` says "I will just rebuild the innerJS as a single string".
- The workspace sync committed every file ([AI Studio sync lesson](ai-studio-sync-overwrites-repo.md)).
- Nobody reviewed the export commit, and nothing (CI, a root allowlist) flagged new root files.

## Fix

- b8dc9f6 deleted all 201 files. None was referenced from `src/`, `server.ts`, the `package.json` scripts, `index.html` or the Vite/TS config. Git history keeps them: `git show b8dc9f6^:<file>`.
- 95fce20 limited `tsc` to `src`, `server.ts` and `vite.config.ts` (`tsconfig.json:26-27`). 818b8db limited Tailwind to `src/`.
- ea8091e added rule R9 to `npm run check` (today `scripts/check-boundaries.mjs:16-20`, `:74-84`): git may track only the agreed entries at the repo root, so a committed root script now fails the check. 03f1ba0 added `.github/` and `LICENSE` to the list, and a tracked `.aistudio/` or `data.json` now fails with its own message ("re-added by an AI Studio sync; remove it from git with `git rm -r --cached`"). R9 is skipped with a warning ("not a git checkout (or git is not installed)") when `git ls-files` cannot run. See [design spec §3.2](../../spec/DOE-Magic/design-spec.md#32-layer-rules-enforced-by-npm-run-check).
- The scripts target pre-reorganisation paths such as `src/components/ProjectAnalysis.tsx` and `src/utils/htmlExport.ts`. Re-running one today fails because the file is missing. A stale AI Studio push, however, could bring back both the scripts and those paths.
- Candidates to rewrite as real tests against `src/core` (BLD-4):
  - `test-ols.mjs`: OLS on a 2² design plus centre points.
  - `test-lof.js` / `test-lof.mjs` and `test-anova-pure.js`: pure error and lack of fit.
  - `test-predict.js`: prediction from named parameter estimates (main-effect and `A*B` term parsing), a standalone copy rather than `predictModelResponse` itself.
  - `test-surrogate.js` and `test-full-gp.mjs`: the optimizer's surrogate model.

  They copy the maths instead of importing it, so they cannot be reused as they are.

## Rule

Never commit scratch, patch, debug or inspection scripts, or dumps of files. Edit source files directly, and look at old versions through git history rather than copies.

A script worth keeping goes into `scripts/`, with a `package.json` entry and a line in AGENTS.md, or it becomes a test.

**How to apply:**

- Before every commit, and after every AI Studio push, run `git status --short` and look at every new file outside `src/`, `docs/` and `scripts/`.
- The tracked root may contain only these (the R9 list):
  - `server.ts`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` and `metadata.json`;
  - `.env.example` and `.gitignore`, plus `bun.lock` and `package-lock.json`, which are allowed but not tracked (decision 1);
  - `README.md`, `AGENTS.md`, `CLAUDE.md` and `LICENSE`;
  - `.github/`, `public/`, `assets/` (nothing tracked since cc41f15 deleted `assets/.aistudio/.gitignore`), `scripts/`, `docs/` and `src/`.

  Adding an entry means updating the list in `scripts/check-boundaries.mjs` and AGENTS.md.
- Keep throwaway scripts in a folder outside the repo.
- When you prompt an AI agent, tell it to edit files in place and to delete any helper script it creates.
- Run `npm run check`. R9 fails on a tracked root entry outside the list above, and R1 on a new top-level entry in `src/`. R9 sees only files git tracks, so an uncommitted script at the root passes until it is added; `git status --short` still catches it.
