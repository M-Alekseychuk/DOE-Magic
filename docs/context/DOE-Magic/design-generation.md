# DOE-Magic — Design Generation

> Created: 2026-10-20. Status: reference for the current code (branch `chore/project-structure-and-core-docs`). It describes what the generators do today, defects included. It does not describe intended behaviour.
> Related: [Statistics engine](statistics-engine.md), [MCP server](mcp-server.md), [Web UI](web-ui.md), [Roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md), [Design spec](../../spec/DOE-Magic/design-spec.md), [Status and handoff](../../task/DOE-Magic/status-and-handoff.md), [Forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md)

Audience: a statistician or AI agent who has to fix design generation. Every statement here was checked against the current files. Lines marked *run* were re-run against the current code on 2026-10-20; see [How to verify numerically](#how-to-verify-numerically).

## Summary

- There are **two generators** with the same branches:
  - the browser uses `generateRuns` inside `src/web/features/design/ProjectDesign.tsx:451-991`;
  - `generateDesign` in `src/core/design/doeGenerator.ts:20-457` is called **only by the MCP server**.

  They have drifted apart (DES-8, MCP-19, UI-15). See [Differences between the two generators](#differences-between-the-two-generators).
- These types follow a textbook construction (apart from the centre-point, order and randomisation rules below):
  - full factorial;
  - Plackett-Burman with 12 and 20 runs;
  - face-centred CCD with a full 2^c cube;
  - Box-Behnken for 3-5 continuous factors.

  Two do not deliver what their labels promise:
  - the "fractional factorial" is a D-optimal subset, not a regular fraction (DES-2);
  - the "Definitive Screening Design" (DSD) is not built from a conference matrix, so its main effects are correlated (DES-3).
- The D-optimal criterion never includes quadratic terms (DES-4), and neither does the analysis model (STAT-3). So no design here is optimised or analysed for curvature.
- MCP designs are not randomised. The UI uses a biased, unseeded shuffle (DES-7). Generating a design replaces all runs, measured results included, without confirmation (DES-1).

## Files and callers

| File | Lines | Exports | Used by |
|---|---|---|---|
| `src/core/design/doeGenerator.ts` | 457 | `generateDesign`, `GenerateDesignOptions`, `GeneratedDesignResult` | MCP `create_project` (`src/server/mcp/doeMcpServer.ts:273`, passes `centerPoints` only) and `generate_doe_design` (`:462`, passes `centerPoints` and `targetRuns`) |
| `src/core/design/dOptimal.ts` | 213 | `generateDOptimalSubset`, `buildCandidateRow`, `computeLogDetXtX` | `doeGenerator.ts:3`; `ProjectDesign.tsx:9` (calls at 494, 525, 676, 835, 858, 923) |
| `src/core/design/designMatrixData.ts` | 102 | `designMatrix` (resolution table) | `src/web/features/design/TwoLevelDesignSelector.tsx:2` |
| `src/core/design/doePatterns.ts` | 49 | `getRunPattern` | `ProjectDesign.tsx:1553`, `src/web/pages/ProjectView.tsx:164` (Excel), `src/web/features/export/htmlExport.ts:178` |
| `src/web/features/design/ProjectDesign.tsx` | 1,632 | component; `generateRuns` (451-991), augmentation (994-1085), run-count planner (144-183) | Design tab |
| `src/web/features/design/TwoLevelDesignSelector.tsx` | 194 | component | `ProjectDesign.tsx:1383-1387` |

Dependency note: `dOptimal.ts:4` imports `getFactorContrasts` from `src/core/analysis/analysisCore.ts`, so designs are scored with the analysis coding. `dOptimal.ts:1-2` imports `jstat` but never uses it (STAT-25).

## Conventions shared by both generators

- **`DesignType` values:** `factorial_2level | dsd | ccd | bbd | plackett_burman | custom_d_optimal` (`src/core/types.ts:2`). There are no mixture, split-plot, blocked or Taguchi designs. Blocking is not implemented anywhere.
- **Runs are stored in natural units:**
  - low = `min`, high = `max`, centre = `(min+max)/2`;
  - categorical factors hold the level label, with default levels `['Level 1', 'Level 2']`.
  - Coding to ±1 happens later in `getFactorContrasts` (see [Statistics engine](statistics-engine.md#2-factor-coding--getfactorcontrasts-58-88)).
- **Nothing checks `min < max`** (UI-27).
- **Candidate grids:** a Cartesian product in which the **last** factor varies fastest (`doeGenerator.ts:49-67`, `ProjectDesign.tsx:459-477`). This is not Yates order. CCD cube points use the opposite convention: bit `idx` of the run index, so the first factor varies fastest.
- **New runs:** every response is set to `null`. `id` comes from `uuidv4()`.

## Design types: implemented vs textbook

Notation: c = number of continuous factors, q = number of categorical factors, k = c + q, cp = centre points.

| Type (`designType`) | What the code builds | Textbook | Gap | Issues |
|---|---|---|---|---|
| Full factorial (`factorial_2level`, run count = full grid) | Every combination of `{min, max}` per numeric factor and all levels per categorical factor (`doeGenerator.ts:409-448`, `ProjectDesign.tsx:908-959`). With 3+ level categoricals the UI calls it "General Mixed-Level Factorial Design" (`:955`). | 2^k (or mixed-level) full factorial in standard order, randomised, optionally with centre points. | Matches, except order, centre-point and randomisation rules (below). | DES-6, DES-7 |
| "Fractional factorial" (`factorial_2level`, `0 < targetRuns < full grid`) | `generateDOptimalSubset` of the full grid (`doeGenerator.ts:421-426`, `ProjectDesign.tsx:921-940`). Notes say "Resolution-optimized". There are no generators, no defining relation and no resolution logic anywhere in `src/`. | Regular 2^(k−p) fraction defined by p generators; resolution = length of the shortest word in the defining relation; minimum-aberration catalogue. | The resolution shown by the selector is never built. *Run*: 4 factors/8 runs (labelled IV) → Res III, a main effect fully aliased with a 2FI (\|r\| = 1); 5/16 (labelled V) → main-main \|r\| = 0.25, main-2FI 0.5; 6/32 (labelled VI) → main-main 0.125, main-2FI 0.378. Reported D-efficiency 100/99/95. | DES-2, DES-9, DES-10, UI-14 |
| Plackett-Burman (`plackett_burman`) | Cyclic shifts of the standard generator row: 11 entries (N = 12) for k ≤ 11 and 19 entries (N = 20) otherwise, plus an all-low row (`doeGenerator.ts:298-348`, `ProjectDesign.tsx:782-826`). Factors with index ≥ 19 are always low (`doeGenerator.ts:311`, `ProjectDesign.tsx:795`). | Plackett & Burman (1946): N a multiple of 4, rows are cyclic shifts of a generator plus a row of minuses; main effects orthogonal, 2FIs partially aliased. | Rows match the published N = 12 and N = 20 designs. No N = 24, 28, ... With 20 or more factors the extra factors never vary, and nothing warns about it (*run*: factor 20 has one value). | DES-12 |
| PB fallback (any categorical with more than 2 levels) | D-optimal subset of a 2-level-numeric / all-categorical-levels grid. The UI always uses 12 runs (`ProjectDesign.tsx:834`); core uses `targetRuns` or 12 (`doeGenerator.ts:356`). Labelled "Orthogonal screening array". | No orthogonal-array guarantee. | The note claims orthogonality that is not checked. | DES-12 |
| CCD (`ccd`) | Face-centred only (α = 1): the full 2^c cube, 2c axial points at `min`/`max` with the other factors at centre, and centre points (`doeGenerator.ts:110-224`, `ProjectDesign.tsx:514-661`). With categoricals, the continuous CCD is repeated for every categorical combination ("Stratified CCD"). With no continuous factor, it falls back to D-optimal. | Box-Wilson CCD: 2^c or Res V 2^(c−p) cube, 2c axial points at ±α (α = 1 face-centred, (n_F)^(1/4) rotatable, or orthogonal), typically 3-6 centre points. | Only α = 1; never a fractional cube (c = 10 gives more than 1,000 runs); centre-point count ignored in the UI. Analysis cannot fit the quadratic model the design is meant for. | DES-14, DES-6, STAT-3 |
| Box-Behnken (`bbd`) | Every pair of continuous factors at the four ±1 combinations, others at centre, plus centre points (`doeGenerator.ts:226-296`, `ProjectDesign.tsx:662-781`); repeated across categorical combinations. With fewer than 3 continuous factors it falls back to "D-Optimal RSM" in core and in the UI's with-categoricals path. The UI's continuous-only path has no such guard: k = 2 gives a 2² factorial plus a centre point labelled BBD, and k = 1 gives one run. | Box & Behnken (1960): built from balanced incomplete block designs. The pairwise form is the published design for k = 3, 4, 5. For k = 6 the published design has 48 runs plus centre points. | k ≥ 6 is not the published design (k = 6 gives 60 runs). | DES-14, DES-8 |
| "DSD" (`dsd`), continuous only | For each factor i, a row with factor i at centre and every other factor j at `(−1)^(i+j)` (high if i + j is even), its fold-over, then centre point(s) (`doeGenerator.ts:379-407`, `ProjectDesign.tsx:870-907`). | Jones & Nachtsheim (2011) and Xiao, Lin & Bai (2012): `[C; −C; 0]`, where C is an m × m **conference matrix** (zero diagonal, ±1 elsewhere, C'C = (m−1)I). For odd m, use order m+1 and drop a column. Main effects are orthogonal to each other and to 2FIs and quadratics. | The code's C has entries (−1)^(i+j), so for columns j and k, C'C = (m−2)(−1)^(j+k). Main-effect columns therefore correlate at (m−2)/(m−1): *run* 0.667, 0.800 and 0.857 for m = 4, 6, 8. | DES-3 |
| "DSD" with categoricals | D-optimal subset of a 3-level-numeric × all-levels grid, with N = `max(2c + 1 + 2q, pMain + 2)`. `targetRuns` is ignored (`doeGenerator.ts:366-378`, `ProjectDesign.tsx:850-869`). | Jones & Nachtsheim (2013): DSD with added two-level categorical factors. | Not a DSD. *Run*: 4 numeric + 1 two-level categorical gives 11 runs with **0** mid-level settings, so the design has no third level. | DES-3, DES-4 |
| Custom D-optimal (`custom_d_optimal`) | D-optimal subset of a grid with 3 levels per numeric factor when k ≤ 5, else 2 levels, and all categorical levels. Default N = `min(M, max(pMain + 3, 12))` (`doeGenerator.ts:91-108`, `ProjectDesign.tsx:479-513`). | Optimal design for a user-specified model, usually by coordinate exchange (Meyer & Nachtsheim 1995). | The model is fixed (main effects ± 2FIs, never quadratic). *Run*: 5 factors, 12 runs → 0 mid-level cells. Core notes say "D-Efficiency: 10000.0%". | DES-4, DES-5, DES-9 |

Fallback note: the criterion has no quadratic terms, so mid-level points are never deliberately selected. Any that do appear are incidental. *Run*: the core BBD fallback with 2 numeric factors and one 3-level categorical put 4 of 32 numeric settings at mid-level. With 2 numeric factors only, it returns the whole 3² grid (N ≥ M).

## D-optimal algorithm (`dOptimal.ts`)

| Step | Code | Remark |
|---|---|---|
| Run count | `N = min(M, max(k + 1, targetRuns))` (114) | Raised to k+1, not to the number of model parameters (DES-5). If N ≥ M, it returns every candidate with efficiency 100 (116-121). |
| Model | Intercept + main effects (`getFactorContrasts` coding); all 2FIs only when `N ≥ pMain + pInt + 2` (124-139) | Never quadratic (DES-4). With small N the model is main-effects only, so any orthogonal main-effect array scores 100% and nothing prefers Res IV over Res III. This is how DES-2 arises. |
| Candidates | The caller's Cartesian grid; each candidate at most once (`selected` Set) | No replicated points. |
| Start | Deterministic, evenly spaced indices `floor(i·M/N)`, then filled (147-157) | No random starts (DES-9). |
| Exchange | For each position, try every unselected candidate; recompute `log det(X'X + 1e-4·I)` by Cholesky from scratch; keep the best gain > 1e-4; at most 3 passes; stop early if a pass does not improve (164-198) | Fedorov-type point exchange. The comment (106) and the UI text (`ProjectDesign.tsx:1198`) call it "coordinate exchange". Cost per pass is about N·M·(N·p² + p³) on the main thread (DES-11). |
| Criterion failure | `computeLogDetXtX` returns −1e9 if n < p or a pivot ≤ 1e-9 (47-102) | |
| Efficiency | `exp((logdet_S − logdet_full)/p − ln(N/M))·100`, rounded and clamped to [25, 100]; **95** if either log-det is −1e9 (200-207) | Per-run information relative to the whole candidate grid, not the usual `100·\|X'X\|^(1/p)/N`. The value is already on a 0-100 scale. Core notes (`doeGenerator.ts:108`) and MCP (`doeMcpServer.ts:494`) multiply by 100 again; the UI shows it correctly (`ProjectDesign.tsx:1512-1514`). |

Measured cost (*run*, this machine): a half fraction takes 0.04 s for k = 6 and 0.47 s for k = 7, roughly ×12 per factor. The registry extrapolates to about 1.5 min for k = 9 (DES-11).

## Centre points, randomisation, replicates, augmentation

**Centre points:**

| Path | Rule |
|---|---|
| Setup tab | `project.centerPoints`, default 0, with a text explaining curvature and pure error (`src/web/features/setup/ProjectSetup.tsx:174-188`). |
| UI generator | Applied only to `factorial_2level` (full **and** fractional) and `custom_d_optimal` (`ProjectDesign.tsx:962-984`). CCD, BBD and DSD hard-code 1 centre point (`:569-573`, `:647-653`, `:706-708`, `:769-773`, `:895-899`). PB adds none. Categoricals are set to `levels[0]`. There is no check for a continuous factor, so an all-categorical design gets `centerPoints` duplicates of one corner run (DES-19). |
| Core generator | `options.centerPoints`, default 3 (`doeGenerator.ts:89`). The regular CCD, BBD and continuous DSD paths use `max(1, cp)`. The 2-level PB path adds `cp`. Factorial adds them to the **full** factorial only, and only when there is a continuous factor (`:431`). Fraction, custom D-optimal and every D-optimal fallback (CCD all-categorical, BBD with c < 3, PB fallback, DSD with categoricals) add none, even when `centerPoints` > 0; the UI does add them for custom D-optimal (DES-21). Categoricals are set to `levels[0]` (`:339`, `:437`). |
| MCP | `create_project` defaults to 3 (`doeMcpServer.ts:244`). `generate_doe_design` uses `project.centerPoints \|\| 3` when the call omits `centerPoints`, so a stored 0 becomes 3 (`:460`). An explicit `centerPoints: 0` in the call is honoured. |

Textbook practice: honour the requested count, and spread categorical centre runs across levels (or level combinations) so that they stay balanced. DES-6 covers all of these deviations.

**Randomisation (DES-7):**

- **Core:** none. `runOrder = stdOrder = 1..N` (`doeGenerator.ts:74-77`; *run*: `runOrder == stdOrder` for every generated design).
- **UI:** `newRuns.sort(() => Math.random() − 0.5)`, then `runOrder = 1..N` (`ProjectDesign.tsx:987-988`). A comparator-based shuffle is not a uniform permutation, it is unseeded, and nothing is recorded.
- **UI standard order:** `stdOrder` is 0 for continuous CCD, BBD, PB and DSD runs and for added centre points (for example `:628`, `:765`, `:805`, `:892-893`, `:978-979`), so standard order is lost.
- **Textbook:** Fisher-Yates with a stored seed, keeping standard order.

**Augmentation (UI only: the Design tab's "Augment Design" menu at `ProjectDesign.tsx:1461-1472` and the separate "Add Empty Run" button at `:1475`):**

| Action | Code | Behaviour |
|---|---|---|
| Replicate design | `replicateDesign` (1053-1067) | Appends a copy of every run with responses cleared. The copies get new `runOrder` and `stdOrder` values after the current maximum. Not randomised, and the link to the original standard-order point is lost. |
| Add centre points | `addCenterPoints(3)` (994-1014) | Appends 3 runs at numeric centre. Categoricals are set to `levels[0]`, or `''` when the factor has no `levels` array. With `levels: []` the test `fac.levels ? fac.levels[0] : ''` is truthy, so the run gets `undefined` (DES-20). |
| Add axial points | `addAxialPoints` (1016-1051) | α = 1: for each numeric factor, a run at `min` and a run at `max`, with the others at centre and categoricals as above. |
| Add empty run | `addEmptyRun` (1069-1085) | All factors at `min` or the first level. `runOrder = runs.length + 1` can duplicate an existing order. |

There is no core augmentation function and no MCP augmentation tool.

**Overwrite:**

- The Generate button calls `generateRuns` directly (`ProjectDesign.tsx:1188`). It replaces `project.runs` (`:990`).
- MCP `generate_doe_design` does the same (`doeMcpServer.ts:469`).
- No `confirm()` exists anywhere in `src/web` (DES-1, MCP-10, UI-2).

## Resolution table and selector

- `designMatrixData.ts` is a hard-coded map `runs → k → {p, res, color}` for 4-512 runs and 3-21 factors.
- Colour codes:
  - `R` = Res III;
  - `Y` = Res IV;
  - `G` = Res V or higher;
  - `B` = 8 runs/7 factors only, which has no legend entry (`TwoLevelDesignSelector.tsx:39-42` vs `:61-78`).
- No source is cited (DES-17).
- The selector (`TwoLevelDesignSelector.tsx:16-46`) shows rows of 4-512 runs and columns of 2-16 factors:
  - `2^k == runs` → full;
  - `2^k < runs` or `runs < 4` → invalid;
  - otherwise a table lookup.

  The keys for 17-21 factors can never be shown.
- It appears only for `factorial_2level` when every categorical has exactly 2 levels (`ProjectDesign.tsx:1381-1387`).
- **A click only sets `targetRuns`.** The resolution label is display-only. The run matrix comes from the D-optimal subset above (DES-2).
- The planner's `useEffect` (`ProjectDesign.tsx:447-449`) resets `targetRuns` whenever the recommendation changes (DES-15). The default for more than 4 factors is `max(8, 2^(k−1))` (`:183`).

Table entries the registry flags as wrong (DES-10):

| Entry | Table says | Should be |
|---|---|---|
| 128 runs, 12-21 factors | V | IV. Res V allows at most 11 factors in 128 runs. |
| 256 runs, 13-14 factors | VI | Res VI allows at most 12 factors in 256 runs. |
| 256 runs, 18-21 factors | V | Res V is believed to allow at most 17 factors in 256 runs. |
| 512 runs, 17 vs 18 factors | V vs VI | Inconsistent: dropping a column cannot lower the resolution, so 17 must be at least VI if 18 is VI. |

## Run-pattern labels (`doePatterns.ts`)

`getRunPattern` builds one symbol per factor:

- `+` / `-` (ASCII hyphen) for numeric values above or below centre;
- `○` for a value within 15% of the half-range from centre (40-47), and for every value when `min == max` (38);
- `?` for a missing or non-numeric value;
- for a categorical, the letter of its level index (A, B, …). If the label is not found, the value's first letter is used.

The level match is exact and case-sensitive (`f.levels.indexOf(valStr)`, line 20); only the run value is trimmed (18), not the level labels. The analysis engine matches after trimming and ignoring case (DES-16).

## Differences between the two generators

| Aspect | UI `generateRuns` (`ProjectDesign.tsx`) | Core `generateDesign` (`doeGenerator.ts`) |
|---|---|---|
| Caller | Generate button (1188) | MCP only |
| Centre points | `project.centerPoints` for factorial (full or fractional) and custom D-optimal; 1 for CCD, BBD and DSD; 0 for PB | `options.centerPoints ?? 3`; `max(1, cp)` for CCD, BBD and DSD; `cp` for PB; full factorial only |
| Randomisation | Biased `sort` shuffle | None |
| `stdOrder` | 0 for continuous CCD, BBD, PB, DSD and centre runs | 1..N |
| "All categorical are 2-level" | `levels.length === 2` (147); a 1-level categorical triggers the PB fallback | `<= 2` (38) |
| `pMain` for a 1-level categorical | `max(1, L−1)` = 1 (157-159) | `L − 1` = 0 (41-47) |
| `targetRuns = 0` | Passed through for CCD with all-categorical factors and for the BBD fallback with categoricals (`:524`, `:675`). The planner gives 0 for these (`:165-173`), so `generateDOptimalSubset` returns k+1 runs and reports 95% when singular. | `targetRuns > 0` required, else the type's default |
| Continuous-only BBD with c < 3 | No guard: k = 2 → 2² + centre labelled BBD; k = 1 → 1 run (750-781) | Falls back to D-optimal RSM (228-240) |
| PB fallback size | Always 12 (834) | `targetRuns` or 12 (356) |
| DSD (continuous) size | 2m + 1 | 2m + `max(1, cp)` (default 2m + 3) |
| D-efficiency text | Shown as `{dEfficiency}%` (1512-1514); correct scale | Notes and MCP multiply by 100 again (108; `doeMcpServer.ts:494`) |
| Fallback messages | `setImportStatus` warnings (for example `:518-521`, `:666-669`) | Notes only |
| Names/notes | For example "D-Optimal RSM Design (BBD Alternative)", "General Mixed-Level Factorial Design" | "D-Optimal RSM Design", "Full Factorial Design" |
| MCP `create_project` | — | Never builds a fraction: `targetRuns` is not passed (`doeMcpServer.ts:273`) |

The categorical-combination loop is written four times (`doeGenerator.ts:160-170`, `:267-277`; `ProjectDesign.tsx:576-586`, `:710-720`). The design-type enum and display names are repeated across files (DES-18).

## Known issues

These are from the issue registry. The fix plans and their order are in the [roadmap and backlog](../../spec/DOE-Magic/roadmap-backlog.md); search for the ID.

| ID | Sev. | One line |
|---|---|---|
| DES-1 | Critical | Generating a design overwrites all runs and measured responses without confirmation (UI and MCP). |
| DES-2 | Critical | The "fractional factorial" is a D-optimal subset without the resolution the selector shows. |
| DES-3 | Critical | The "DSD" is not a conference-matrix DSD; main effects correlate at (m−2)/(m−1). |
| DES-4 | High | The D-optimal model has no quadratic terms, so RSM and categorical-DSD fallbacks do not target mid-level points. |
| DES-5 | High | D-efficiency is misreported: ×100 twice, 95 for singular designs, clamped 25-100, N raised only to k+1. |
| DES-6 | High | The centre-point setting is ignored or overridden (UI CCD/BBD/DSD/PB, MCP `\|\| 3`, categorical centre runs at `levels[0]`). |
| DES-7 | High | No valid, reproducible randomisation; standard order is lost in the UI. |
| DES-8 | High | The UI uses a forked copy of the generator that has drifted from core. |
| DES-9 | Medium | The D-optimal exchange is weak, deterministic and mislabelled "coordinate exchange". |
| DES-10 | Medium | The resolution table contains wrong resolutions. |
| DES-11 | Medium | D-optimal generation freezes the browser for 9+ factors. |
| DES-12 | Medium | PB silently holds factors 20+ constant; the categorical fallback is mislabelled orthogonal. |
| DES-13 | Medium | Comma-to-dot replacement corrupts numbers with thousands separators. |
| DES-14 | Low | CCD is always face-centred with a full cube; BBD for k ≥ 6 is not the published design. |
| DES-15 | Low | The planner overwrites the user's chosen run count. |
| DES-16 | Low | Run-pattern labels use different level matching from the engine. |
| DES-17 | Low | The resolution table has unreachable entries, an unlegended colour and no source. |
| DES-18 | Low | Design-type enum and display names are duplicated across files. |
| DES-19 | Medium | The UI adds `project.centerPoints` centre runs to `factorial_2level` and `custom_d_optimal` designs even when every factor is categorical, writing duplicate `levels[0]` runs (`ProjectDesign.tsx:962-984`); core adds them only when a continuous factor exists (`doeGenerator.ts:431`). |
| DES-20 | Low | Augmentation (`addCenterPoints`, `addAxialPoints`) writes `undefined`, not `''`, for a categorical whose `levels` is an empty array (`ProjectDesign.tsx:1000`, `:1026`, `:1039`). |
| DES-21 | Medium | Core adds no centre points to custom D-optimal designs or D-optimal-subset fractions even when `centerPoints` > 0 (`doeGenerator.ts:91-108`, `:421-426`), while the UI does for custom D-optimal (`ProjectDesign.tsx:963-964`). Another fork divergence ([forked logic drifts](../../memory/DOE-Magic/forked-logic-drifts.md)). |

These issues in other areas are about the same code: MCP-10 (`generate_doe_design` overwrite and `|| 3`), MCP-13 (D-efficiency ×100), MCP-19 (forked generators), UI-2 (overwrite), UI-14 (resolution promise), UI-15 (fork, biased shuffle), DATA-6 and UI-12 (Excel run import), STAT-3 (analysis has no quadratic terms).

### Unregistered findings from this review

Two earlier findings are now registered as DES-20 and DES-21.

- **`addEmptyRun` uses `runOrder = runs.length + 1`** (`ProjectDesign.tsx:1079`). This is the same collision pattern as DATA-20 and is tracked under it.
- **Nuance for DES-4:** the "D-Optimal RSM" fallback does not always end up with zero mid-level points. *Run*: 2 numeric factors plus one 3-level categorical gave 4 of 32 numeric settings at mid-level. Those points are incidental, because the criterion has no quadratic terms. The custom D-optimal and categorical-DSD cases did give 0.

## How to verify numerically

Use a `.mts` script **outside the repo** ([lesson](../../memory/DOE-Magic/patch-scripts-in-repo-root.md)):

1. Import `generateDesign` (or `generateDOptimalSubset`) through `pathToFileURL('<repo>/src/core/design/doeGenerator.ts')`.
2. Run it with `<repo>/node_modules/.bin/tsx`.
3. Code every numeric factor as `2(x − mid)/range`, then check the invariants.

These are the results on 2026-10-20 (numeric factors 0-100):

| Check | Call | Invariant (textbook) | Current result |
|---|---|---|---|
| DES-2 | `generateDesign(4 numeric, 'factorial_2level', {targetRuns: 8, centerPoints: 0})` | Res IV: max \|r\|(main, 2FI) = 0 | 1.000 (Res III); dEff 100 |
| DES-2 | Same, 5 factors, 16 runs | Res V: main-main 0, main-2FI 0 | 0.250 and 0.500; dEff 99 |
| DES-2 | Same, 6 factors, 32 runs | Res VI: 0 and 0 | 0.125 and 0.378; dEff 95 |
| DES-3 | `generateDesign(m numeric, 'dsd', {centerPoints: 1})` | max \|r\| between main-effect columns = 0 | m = 4: 0.667; m = 6: 0.800; m = 8: 0.857 |
| DES-4 | `'custom_d_optimal'`, 5 numeric, `targetRuns: 12` | An RSM-intended design has mid-level points | 0 mid-level cells |
| DES-4 | `'dsd'`, 4 numeric + 1 two-level categorical | Every numeric factor at 3 levels | 0 mid-level cells, 11 runs |
| DES-5 / MCP-13 | Same custom D-optimal call; read `notes` | Efficiency text ≤ 100% | "D-Efficiency: 10000.0%" |
| DES-7 | Any `generateDesign` call | `runOrder` is a random permutation | `runOrder == stdOrder` for every run |
| DES-11 | `generateDOptimalSubset(2^k grid, k numeric, 2^(k−1))` | — | k = 6: 0.04 s; k = 7: 0.47 s |
| DES-12 | `'plackett_burman'`, 20 numeric, `centerPoints: 0` | Every factor varies | The 20th factor has one value in all 20 runs |

For fixes, take reference designs from a published catalogue (minimum-aberration fractions, conference-matrix DSDs, Box-Behnken tables), from JMP or Design-Expert, or from R (`FrF2`, `daewr::DefScreen`, `rsm`). Pin them in golden-output tests that run both the UI path and the core path (MCP-19) before deleting `generateRuns`.

References:

- Plackett & Burman (1946), *Biometrika* 33:305-325.
- Box & Behnken (1960), *Technometrics* 2:455-475.
- Meyer & Nachtsheim (1995), *Technometrics* 37:60-69.
- Jones & Nachtsheim (2011), *J. Quality Technology* 43:1-15.
- Xiao, Lin & Bai (2012), *J. Quality Technology* 44:2-8.
- Jones & Nachtsheim (2013), *J. Quality Technology* 45:121-129.
