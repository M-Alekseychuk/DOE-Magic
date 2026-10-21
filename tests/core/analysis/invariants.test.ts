// Properties every least-squares fit must have, checked on every fixture model.
// Σ leverage = rank and 0 ≤ h ≤ 1 are checked with the reference comparisons
// (itMatchesReference, and rankDeficient.test.ts for STAT-1).
import { describe, expect, it } from 'vitest';
import { predictModelResponse } from '../../../src/core/analysis/analysisCore';
import { analyse, analyseFixture, loadFixture } from '../../helpers/fixtures';
import { expectClose } from '../../helpers/reference';

const IDS = [
  'montgomery-ex6-1-plasma-etch',
  'montgomery-ex6-2-filtration',
  'montgomery-ex8-1-half-fraction',
  'montgomery-ex11-2-ccd',
  'pb12-6f-3cp',
  'dsd-6f-conference',
  'factorial-2x3-saturated',
  'half-fraction-2x4-1-3cp',
  'demo-suzuki-cross-coupling',
];

// A column name with its interaction parts sorted, so 'A*B' and 'B*A' compare equal.
const canonical = (term: string) => term.split('*').sort().join('*');

for (const id of IDS) {
  loadFixture(id).models.forEach((_, index) => {
    const { result, project, ref, model } = analyseFixture(id, index);

    describe(`${id} / ${model.name}`, () => {
      it('predictions at the design points equal the fitted values, also from a JSON-serialised result', () => {
        const serialised = JSON.parse(JSON.stringify(result));
        project.runs.forEach((run, i) => {
          const fitted = (result.studentizedResiduals as any[])[i].predicted as number;
          expectClose(predictModelResponse(result, run.factors, project), fitted, `closure ŷ[${i}]`);
          expectClose(predictModelResponse(serialised, run.factors, project), fitted, `serialised ŷ[${i}]`);
        });
      });

      // With aliased columns, which column is reported as aliased depends on the order (by contract).
      if (ref.aliasedColumns.length === 0) it('coefficients do not depend on the order of the factors', () => {
        const reversed = { ...project, factors: [...project.factors].reverse() };
        const excluded = model.excludedTerms.map((t) => t.split('*').reverse().join('*'));
        const other = analyse(reversed, model.responseId, excluded);
        const byTerm = new Map((other.parameterEstimates as any[]).map((r) => [canonical(r.term), r.estimate as number]));
        for (const r of result.parameterEstimates as any[]) {
          expect(byTerm.has(canonical(r.term)), `term ${r.term} after reordering`).toBe(true);
          expectClose(byTerm.get(canonical(r.term)), r.estimate, `${r.term} estimate after reordering`);
        }
      });
    });
  });
}
