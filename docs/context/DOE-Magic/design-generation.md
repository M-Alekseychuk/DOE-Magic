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

  Two previously defective generators have been replaced with textbook constructions (P0.11, P0.12):
  - Regular $2^{k-p}$ fractional factorials (`src/core/design/fractions.ts`) built from minimum-aberration generators (Montgomery 2013 Table 8.14 / Wu & Hamada 2009 / NIST §5.3.3.4.7), matching the corrected resolution table in `src/core/design/designMatrixData.ts` (DES-2, DES-10, DES-17, UI-14).
  - Definitive Screening Designs (`src/core/design/dsd.ts`) built from Paley conference matrices $[C; -C; 0]$ per Jones & Nachtsheim (2011, 2013) and Xiao, Lin & Bai (2012), with mutually orthogonal main effects and main effects orthogonal to all 2FIs and pure quadratics (DES-3).
- Both the D-optimal criterion and the analysis model include quadratic terms when 3-level continuous factors are present (P0.9 / STAT-3, DES-4).
- D-efficiency is reported as $100 \cdot |X'X|^{1/p} / N$ on a $0$–$100$ scale, or `null` ("not estimable") for singular designs, without double $\times 100$ scaling (P1.18 / DES-5, MCP-13).
- Designs assign sequential `stdOrder = 1..N` in standard order and then shuffle `runOrder = 1..N` with a reproducible seeded Fisher-Yates PRNG (`src/core/design/randomize.ts`, P1.19 / DES-7).
- Centre points are generated across all design types by a single helper (`buildCenterPointRuns` in `src/core/design/centerPoints.ts`, P1.20 / DES-6, DES-19, DES-20, DES-21), distributing categorical centre runs across levels and adding none when no continuous factor exists.
- Generating a design or importing Excel runs asks for confirmation before overwriting measured results (P0.2 / DES-1, UI-2, MCP-10).

## Files and callers

| File | Lines | Exports | Used by |
|---|---|---|---|
| `src/core/design/doeGenerator.ts` | 457 | `generateDesign`, `GenerateDesignOptions`, `GeneratedDesignResult` | MCP `create_project` and `generate_doe_design` |
| `src/core/design/dOptimal.ts` | 240 | `generateDOptimalSubset`, `buildCandidateRow`, `computeLogDetXtX`, `computeExactLogDetXtX`, `computeDEfficiency` | `doeGenerator.ts`; `ProjectDesign.tsx`; `dsd.ts` |
| `src/core/design/randomize.ts` | 75 | `randomize`, `createSeededRng`, `generateRandomSeed` | `doeGenerator.ts`; `ProjectDesign.tsx` |
| `src/core/design/centerPoints.ts` | 110 | `buildCenterPointRuns`, `buildAxialPointRuns`, `getSafeCategoricalLevels` | `doeGenerator.ts`; `fractions.ts`; `dsd.ts`; `ProjectDesign.tsx` |
| `src/core/design/designMatrixData.ts` | 102 | `designMatrix` (resolution table) | `src/web/features/design/TwoLevelDesignSelector.tsx:2` |
| `src/core/design/doePatterns.ts` | 49 | `getRunPattern` | `ProjectDesign.tsx:1553`, `src/web/pages/ProjectView.tsx:164` (Excel), `src/web/features/export/htmlExport.ts:178` |
| `src/web/features/design/ProjectDesign.tsx` | 1,632 | component; `generateRuns`, augmentation, run-count planner | Design tab |
| `src/web/features/design/TwoLevelDesignSelector.tsx` | 194 | component | `ProjectDesign.tsx:1383-1387` |

Dependency note: `dOptimal.ts` imports `getFactorContrasts` from `src/core/analysis/analysisCore.ts`, so designs are scored with the analysis coding.

## Conventions shared by both generators

- **`DesignType` values:** `factorial_2level | dsd | ccd | bbd | plackett_burman | custom_d_optimal` (`src/core/types.ts:2`). There are no mixture, split-plot, blocked or Taguchi designs. Blocking is not implemented anywhere.
- **Runs are stored in natural units:**
  - low = `min`, high = `max`, centre = `(min+max)/2`;
  - categorical factors hold the level label, with default levels `['Level 1', 'Level 2']`.
  - Coding to ±1 happens later in `getFactorContrasts` (see [Statistics engine](statistics-engine.md#2-factor-coding--getfactorcontrasts-src-core-analysis-modelspec-ts)).
- **Nothing checks `min < max`** (UI-27).
- **Candidate grids:** a Cartesian product in which the **last** factor varies fastest (`doeGenerator.ts:49-67`, `ProjectDesign.tsx:459-477`). This is not Yates order. CCD cube points use the opposite convention: bit `idx` of the run index, so the first factor varies fastest.
- **New runs:** every response is set to `null`. `id` comes from `uuidv4()`.

## Design types: implemented vs textbook

Notation: c = number of continuous factors, q = number of categorical factors, k = c + q, cp = centre points.

| Type (`designType`) | What the code builds | Textbook | Gap | Issues |
|---|---|---|---|---|
| Full factorial (`factorial_2level`, run count = full grid) | Every combination of `{min, max}` per numeric factor and all levels per categorical factor (`doeGenerator.ts`, `ProjectDesign.tsx`), plus `cp` centre points when $c > 0$. | 2^k (or mixed-level) full factorial in standard order, randomised, optionally with centre points. | Matches textbook. | — |
| Fractional factorial (`factorial_2level`, `0 < targetRuns < full grid`) | Regular $2^{k-p}$ minimum-aberration fraction (`src/core/design/fractions.ts`, P0.11 / DES-2) when all factors have 2 levels and `targetRuns` is a power of 2; falls back to `generateDOptimalSubset` for mixed-level or non-power-of-2 run counts, plus `cp` centre points when $c > 0$ (P1.20 / DES-21). | Regular 2^(k−p) fraction defined by p generators; resolution = length of the shortest word in the defining relation; minimum-aberration catalogue. | Matches textbook for all regular 2-level fractions. | — |
| Plackett-Burman (`plackett_burman`) | Cyclic shifts of the standard generator row: 11 entries (N = 12) for k ≤ 11 and 19 entries (N = 20) otherwise, plus an all-low row (`doeGenerator.ts`, `ProjectDesign.tsx`), plus `cp` centre points when $c > 0$. | Plackett & Burman (1946): N a multiple of 4, rows are cyclic shifts of a generator plus a row of minuses; main effects orthogonal, 2FIs partially aliased. | Rows match the published N = 12 and N = 20 designs. No N = 24, 28, ... With 20 or more factors the extra factors never vary (DES-12). | DES-12 |
| PB fallback (any categorical with more than 2 levels) | D-optimal subset of a 2-level-numeric / all-categorical-levels grid, plus `cp` centre points when $c > 0$. | No orthogonal-array guarantee. | The note claims orthogonality that is not checked. | DES-12 |
| CCD (`ccd`) | Face-centred (α = 1): the full 2^c cube, 2c axial points at `min`/`max` with the other factors at centre, and `cp` centre points (`doeGenerator.ts`, `ProjectDesign.tsx`, P1.20 / DES-6). With categoricals, the continuous CCD is repeated for every categorical combination ("Stratified CCD"). With no continuous factor, it falls back to D-optimal. | Box-Wilson CCD: 2^c or Res V 2^(c−p) cube, 2c axial points at ±α (α = 1 face-centred, (n_F)^(1/4) rotatable, or orthogonal), typically 3-6 centre points. | Only α = 1; never a fractional cube (c = 10 gives more than 1,000 runs). | DES-14 |
| Box-Behnken (`bbd`) | Every pair of continuous factors at the four ±1 combinations, others at centre, plus `cp` centre points (`doeGenerator.ts`, `ProjectDesign.tsx`, P1.20 / DES-6); repeated across categorical combinations. With fewer than 3 continuous factors it falls back to "D-Optimal RSM". | Box & Behnken (1960): built from balanced incomplete block designs. The pairwise form is the published design for k = 3, 4, 5. For k = 6 the published design has 48 runs plus centre points. | k ≥ 6 is not the published design (k = 6 gives 60 runs). | DES-14, DES-8 |
| DSD (`dsd`), continuous + 2-level categoricals | Conference-matrix DSD $[C; -C; 0_{\text{cp}}]$ (`src/core/design/dsd.ts`, P0.12 / DES-3), with `cp` centre points (P1.20 / DES-6). | Jones & Nachtsheim (2011, 2013) and Xiao, Lin & Bai (2012): `[C; −C; 0]`, where C is an m × m **conference matrix** (zero diagonal, ±1 elsewhere, C'C = (m−1)I). | Matches textbook. | — |
| DSD fallback (3+ level categoricals) | D-optimal subset of a 3-level-numeric × all-levels grid explicitly labelled as D-optimal (P0.9 / P0.12). | — | Honest fallback label. | — |
| Custom D-optimal (`custom_d_optimal`) | D-optimal subset of a grid with 3 levels per numeric factor when k ≤ 5, else 2 levels, and all categorical levels, plus `cp` centre points when $c > 0$ (P1.20 / DES-21). | Optimal design for a user-specified model, usually by coordinate exchange (Meyer & Nachtsheim 1995). | Includes quadratic terms when $N \ge p_{\text{main}} + p_{\text{quad}}$ and numeric factors have $\ge 3$ levels (P0.9 / DES-4). | DES-9 |

## D-optimal algorithm (`dOptimal.ts`)

| Step | Code | Remark |
|---|---|---|
| Run count | `N = targetRuns > 0 ? min(M, targetRuns) : min(M, pMain)` | Default raises $N$ to `pMain`; an explicit `targetRuns < pMain` is kept so singular designs report `dEfficiency: null` ("not estimable", P1.18 / DES-5). |
| Model | Intercept + main effects (`getFactorContrasts` coding); quadratics when $p_{\text{quad}} > 0$ and $N \ge p_{\text{main}} + p_{\text{quad}}$; all 2FIs when $N \ge p_{\text{main}} + p_{\text{quad}} + p_{\text{int}} + 2$ | Includes quadratic terms on 3-level grids (P0.9 / DES-4). |
| Candidates | The caller's Cartesian grid; each candidate at most once (`selected` Set) | No replicated points. |
| Start | Deterministic, evenly spaced indices `floor(i·M/N)`, then filled | No random starts (DES-9). |
| Exchange | For each position, try every unselected candidate; recompute `log det(X'X + 1e-4·I)` by Cholesky; keep the best gain > 1e-4; at most 3 passes | Fedorov-type point exchange. |
| Criterion failure | `computeExactLogDetXtX` returns `null` if $N < p$ or any unregularised Cholesky pivot $\le 10^{-10}$ | Detects singular designs without ridge bias (P1.18 / DES-5). |
| Efficiency | `computeDEfficiency(X)` returns $100 \cdot |X'X|^{1/p} / N$ on a $0$–$100$ scale, or `null` when singular | Standard textbook D-efficiency on the coded scale; never exceeds $100$, and never multiplied by $100$ a second time (P1.18 / DES-5, MCP-13). |

## Centre points, randomisation, replicates, augmentation

**Centre points (`src/core/design/centerPoints.ts`, P1.20 / DES-6, DES-19, DES-20, DES-21):**

- `buildCenterPointRuns(factors, responses, count, startOrder)` adds `count` centre runs (`count` may be `0`) for every design type.
- When `continuousFactors.length === 0`, no centre runs are added (`DES-19`).
- When categorical factors exist, centre runs cycle through `levels[i % levels.length]` so categorical levels are balanced (`DES-6`), and empty `levels` arrays never produce `undefined` (`DES-20`).

**Randomisation (`src/core/design/randomize.ts`, P1.19 / DES-7):**

- `randomize(runs, seed)` assigns `stdOrder = 1..N` in standard order and then shuffles `runOrder = 1..N` using Fisher-Yates and a seeded PRNG (`createSeededRng(seed)`).
- `Project.randomSeed` stores the seed used, and both the UI and HTML export display it.
- MCP randomises by default and accepts `randomize?: boolean` and `randomSeed?: number`.

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
