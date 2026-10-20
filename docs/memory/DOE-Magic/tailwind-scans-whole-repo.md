# DOE-Magic — Lesson: Tailwind scanned the whole repo

> Created: 2026-10-20. Status: fixed on this branch (818b8db); the rule is in AGENTS.md and the design spec.
> Related: [Web UI](../../context/DOE-Magic/web-ui.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Patch scripts in the repo root](patch-scripts-in-repo-root.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md) (BLD-6, BLD-14), [AGENTS.md](../../../AGENTS.md)

## Symptom

- The production CSS was 126,235 B in the pre-change build (818b8db reports about 126 kB before the root cleanup and 118.5 kB after it) and held utilities that no component uses. 818b8db's fix removed 35 such classes; its message names a few, for example `visible`, `invisible`, `inline` and `cursor-*-resize`.
- Its content depended on whatever text files sat in the working tree:
  - the root scratch scripts, some of which contain class strings (`fix2.mjs` builds HTML with `bg-white border border-slate-200 …`);
  - any new README, doc or local build folder.

## Root cause

The stylesheet had `@import "tailwindcss";` with no `source()`. Tailwind v4 then finds sources automatically from its base directory, here the repo root, and scans every text file that `.gitignore` does not exclude.

This was checked for this doc with the installed scanner (Tailwind 4.3.3, `@tailwindcss/oxide` `Scanner`):

- **Pre-cleanup root:** all 201 scratch files and dumps were scanned, `.py`, `.txt` and `.html` included.
- **Today's root, without `source()`:** it scans `public/plotly.min.js` (4.9 MB), `README.md`, `AGENTS.md`, `CLAUDE.md`, every file under `docs/`, `scripts/check-boundaries.mjs`, `server.ts`, `package.json`, `tsconfig.json`, `vite.config.ts`, `metadata.json`, `index.html`, and the untracked, unignored `.baseline-dist/` build snapshot (present when this was measured; since deleted).
- **Skipped:** `package-lock.json` and `bun.lock`, `node_modules/`, gitignored paths and binary files. 818b8db's commit message lists lockfiles among the scanned files, but the scanner check shows they are not.

## Fix

- 818b8db changed `src/web/index.css:2` to `@import "tailwindcss" source("..");`. The path is relative to the stylesheet, so `src/` is the only automatic source.
- The CSS dropped to 116,400 B.
- None of the removed classes appears in `src/` or `index.html`. Plotly injects its own `.js-plotly-plot .plotly .cursor-*` rules, so chart cursors do not depend on Tailwind's copies.

## Rule

Keep `source("..")`. Every Tailwind class the app uses must appear as a complete literal string in a file under `src/`.

**How to apply:**

- If you move `src/web/index.css`, fix the `source()` path, which is relative to the CSS file.
- Do not put classes only in `index.html`, `public/` or docs. If a class really must come from outside `src/`, add an explicit `@source "<path>";` line next to the import, with a comment saying why.
- Write full class names; never build them from fragments (`'bg-' + color`).
- If the CSS size jumps after a change, check which new files are being scanned first.
- The exported HTML report loads Tailwind's Play CDN when it is viewed (`src/web/features/export/htmlExport.ts:54`, UI-21), so its classes do not depend on this build.
