# Reference fixtures for the analysis engine

Each `*.json` file here is one dataset with values that the engine (`src/core/analysis/analysisCore.ts`) must reproduce. The tests in `tests/core/analysis/` and `tests/server/mcp/` load them through `tests/helpers/fixtures.ts`. The list of cases, their sources and the issue IDs they pin is in the [statistics engine doc](../../docs/context/DOE-Magic/statistics-engine.md#reference-tests).

## Format

| Key | Content | Written by |
|---|---|---|
| `id`, `title` | File name without `.json`, and a one-line description | hand |
| `provenance` | `data`: where the runs come from (publication and example number, or the formula and seed of a synthetic response). `published`: which values are printed in the source. `derived`: values that follow from published ones. `recorded`: date | hand |
| `factors`, `responses` | Same shape as `Factor` and `Response` in `src/core/types.ts` | hand |
| `runs` | `{label, factors, responses}` per run, in natural units | hand |
| `models` | The fits to check: `{name, responseId, excludedTerms}` (term IDs as in design spec §4.2) | hand |
| `published` | Numbers printed in the source, at the precision printed | hand |
| `reference` | Numbers computed by `compute_reference.py` for every entry of `models`, with the tool versions and date | script only |

Transcribe published data exactly and cite the example, not just the book. Synthetic responses record their formula and random seed.

## Recomputing the reference blocks

From the repository root, with Python 3, numpy, scipy and statsmodels:

```bash
python tests/fixtures/compute_reference.py
```

The script rebuilds the model matrix from the contract in design spec §4.2 (coding, main effects plus 2FIs, term IDs, the later term in model order is aliased) without reading the engine's code, and fits it with statsmodels OLS on the estimable columns. That is what R `lm()` reports when it gives `NA` for aliased terms. R was not installed when the script was written (open decision 5); a port to R must give the same numbers. Never edit a `reference` block by hand. If the statistical contract changes (for example quadratic terms in P0.9), change the script first, rerun it and review the diff of every fixture.

## Known bugs

A test that fails today because of a registered bug is written as `it.fails('<ID> (<backlog item>): …')`, so `npm test` stays green. When the fix lands, vitest reports those tests as failing because they now pass: change each one to `it(...)` in the same PR. A fix flips only the tests with its own IDs. `it.todo` marks a check that cannot be written until the fix adds an API (the test name says which).

The demo-project snapshot (`tests/core/analysis/__snapshots__/`) records today's output, wrong values included. A PR that changes engine output on purpose updates it with `npx vitest run -u` and explains every changed number. `vitest.config.ts` sets `update: 'none'`, so snapshots are written only with `-u`: a new snapshot test fails until then.
