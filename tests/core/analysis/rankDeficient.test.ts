// Rank-deficient default models: Plackett-Burman 12 runs and a definitive screening design,
// each with 6 factors and 3 centre runs. Main effects + all 2FIs have more columns than the
// design can estimate, so 10 2FI columns are aliased (rank 12 on 15 runs, error DF 3).
// STAT-1 (fixed by P0.3): the engine's (X'X)⁻¹ is wrong here. Coefficients, fitted values,
// SSE and lack of fit depend only on β and are right; everything that reads (X'X)⁻¹ is not.
// The same model refitted explicitly on the estimable columns is right, which shows the
// reference is the reduced model (R lm() with NA for aliased terms).
import { describe, expect, it } from 'vitest';
import { analyse, analyseFixture } from '../../helpers/fixtures';
import * as C from '../../helpers/reference';

// Control: in a regular fraction the aliased columns equal other columns exactly, and the engine is
// right today. P0.3 must leave this output unchanged.
describe('regular 2^(4-1) + 3 centre runs, 3 aliased 2FI columns (control, correct today)', () => {
  const fit = analyseFixture('half-fraction-2x4-1-3cp');
  it('has rank 8, error DF 3 and BC, BD, CD aliased', () => {
    expect(fit.result.p + 1).toBe(fit.ref.rank);
    expect(fit.result.dfError).toBe(3);
    expect((fit.result.effectSummary as any[]).filter((e) => e.isAliased).map((e) => e.id).sort()).toEqual(['B*C', 'B*D', 'C*D']);
  });
  C.itMatchesReference(fit);
});

const CASES: Record<string, string> = {
  'pb12-6f-3cp': 'PB12, 6 factors + 3 centre runs',
  'dsd-6f-conference': 'DSD from a conference matrix, 6 factors + 3 centre runs',
};

for (const [id, label] of Object.entries(CASES)) {
  const { result, ref, project, fixture } = analyseFixture(id);
  const aliasedTerms = (result.effectSummary as any[]).filter((e) => e.isAliased).map((e) => e.id as string);
  const reduced = analyse(project, fixture.models[0].responseId, aliasedTerms);

  describe(`${label}: what is right today`, () => {
    it('has rank 12 and error DF 3, with 10 aliased 2FI columns', () => {
      expect(result.p + 1).toBe(ref.rank);
      expect(result.dfError).toBe(ref.dfError);
      expect(aliasedTerms).toHaveLength(ref.aliasedColumns.length);
    });

    it('coefficients, aliased columns and fitted values match the reference fit', () => {
      C.checkCoefficients(result, ref);
      C.checkFitted(result, ref);
    });

    it('whole-model ANOVA, lack of fit and adequate precision match', () => {
      C.checkAnova(result, ref);
      C.checkLackOfFit(result, ref);
      C.checkAdequatePrecision(result, ref);
    });
  });

  describe(`${label}: the explicit reduced model (aliased terms excluded)`, () => {
    it('drops exactly the aliased terms', () => {
      expect(reduced.dfError).toBe(ref.dfError);
      expect((reduced.parameterEstimates as any[]).some((r) => r.isAliased)).toBe(false);
    });
    C.itMatchesReference({ result: reduced, ref: { ...ref, aliasedColumns: [] } });
  });

  describe(`${label}: STAT-1, values that read (X'X)⁻¹`, () => {
    it('STAT-1 (P0.3): leverages sum to the rank and lie in [0, 1]', () => C.checkLeverageInvariants(result, ref.rank));
    it('STAT-1 (P0.3): the leverage of every run matches the reference', () => C.checkLeverage(result, ref));
    it('STAT-1 (P0.3): standard errors, t ratios and p-values match the reference', () => C.checkInference(result, ref));
    it('STAT-1 (P0.3): standard errors equal those of the explicit reduced model', () => {
      for (const r of (reduced.parameterEstimates as any[]).filter((x) => !x.isReference)) {
        const full = (result.parameterEstimates as any[]).find((x) => x.term === r.term);
        C.expectClose(full.stdError, r.stdError, `${r.term} stdError`);
      }
    });
    it('STAT-1 (P0.3): VIFs match the reference', () => C.checkVif(result, ref));
    it('STAT-1 (P0.3): Type III effect tests match the reference', () => C.checkTypeIII(result, ref));
    it("STAT-1 (P0.3): studentized residuals and Cook's distance match the reference", () => C.checkResidualDiagnostics(result, ref));
    it('STAT-1 (P0.3): the Box-Cox profile matches the reference', () => C.checkBoxCox(result, ref));
  });
}

describe('STAT-1 (P0.3): relative aliasing threshold under column scaling', () => {
  it('does not falsely flag a full-rank design when columns are scaled by 1e3 or 1e-3', async () => {
    const { solveOLS } = await import('../../../src/core/analysis/linalg');
    const X = [
      [1, -1000, -0.001],
      [1,  1000, -0.001],
      [1, -1000,  0.001],
      [1,  1000,  0.001],
    ];
    const Y = [[10], [20], [30], [40]];
    const sol = solveOLS(X, Y);
    expect(sol.rank).toBe(3);
    expect(sol.aliased).toEqual([false, false, false]);
    C.expectClose(sol.beta[0], 25, 'intercept');
    C.expectClose(sol.beta[1], 0.005, 'beta_1');
    C.expectClose(sol.beta[2], 10000, 'beta_2');
  });
});
