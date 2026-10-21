// Montgomery (2013) Example 6.1: plasma etch, 2^3 full factorial with 2 replicates.
// Full rank with pure error; today's engine is expected to be correct here (baseline).
import { describe, expect, it } from 'vitest';
import { analyseFixture } from '../../helpers/fixtures';
import { estimateOf, expectClose, itMatchesReference } from '../../helpers/reference';

const fit = analyseFixture('montgomery-ex6-1-plasma-etch');
const { result, fixture } = fit;
const pub = fixture.published!;

describe('Montgomery Ex. 6.1, replicated 2^3 (published values)', () => {
  it('effects (2β in coded units) match the published estimates', () => {
    for (const [id, effect] of Object.entries(pub.effects as Record<string, number>)) {
      if (id === 'A*B*C') continue; // not in the engine's model (no 3FIs)
      expectClose(2 * estimateOf(result, id), effect, `effect ${id}`);
    }
    expectClose(estimateOf(result, 'Intercept'), pub.intercept, 'intercept');
  });

  it('Type III sums of squares match the published ANOVA', () => {
    for (const [id, ss] of Object.entries(pub.sumOfSquares as Record<string, number>)) {
      if (['A*B*C', 'error', 'total'].includes(id)) continue;
      const e = (result.effectSummary as any[]).find((x) => x.id === id);
      expectClose(e.ss, ss, `SS ${id}`);
    }
    expectClose(result.lackOfFit.sst, pub.sumOfSquares.total, 'SS total');
  });

  it('pure error is the published error and lack of fit is the ABC sum of squares', () => {
    const lof = result.lackOfFit;
    expectClose(lof.ss_pure, pub.sumOfSquares.error, 'SS pure error');
    expect(lof.df_pure).toBe(pub.errorDf);
    expectClose(lof.ss_lof, pub.sumOfSquares['A*B*C'], 'SS lack of fit');
    expect(lof.df_lof).toBe(1);
    expectClose(lof.sse, pub.sumOfSquares.error + pub.sumOfSquares['A*B*C'], 'SSE');
    expect(result.dfError + result.p + 1).toBe(pub.totalDf + 1);
  });
});

describe('Montgomery Ex. 6.1, replicated 2^3 (reference fit)', () => {
  itMatchesReference(fit);
});
