// Montgomery (2013) Example 6.2: filtration rate, unreplicated 2^4.
// The engine's default model (main effects + 2FIs) leaves 5 error DF; Montgomery's final
// model drops B, so the runs that differ only in B become replicates (8 DF pure error).
import { describe, it } from 'vitest';
import { analyseFixture } from '../../helpers/fixtures';
import { estimateOf, expectClose, itMatchesReference } from '../../helpers/reference';

const full = analyseFixture('montgomery-ex6-2-filtration', 0);
const final = analyseFixture('montgomery-ex6-2-filtration', 1);
const pub = full.fixture.published!;

describe('Montgomery Ex. 6.2, unreplicated 2^4 (published values)', () => {
  it('main-effect and 2FI effects match the published estimates', () => {
    for (const [id, effect] of Object.entries(pub.effects as Record<string, number>)) {
      if (id.split('*').length > 2) continue; // 3FIs and the 4FI are not in the engine's model
      expectClose(2 * estimateOf(full.result, id), effect, `effect ${id}`);
    }
  });

  it("Montgomery's final model (A, C, D, AC, AD) matches the published coefficients", () => {
    for (const [id, b] of Object.entries(pub.finalModel as Record<string, number>)) {
      expectClose(estimateOf(final.result, id), b, `coefficient ${id}`, 0, 0.005); // printed to 2 decimals
    }
  });

  // There is no core Lenth function to call yet, and the engine cannot reach these 15 contrasts
  // (its model has no 3FIs). P0.4 adds Lenth to core; its unit test should use these values.
  it.todo('STAT-2 (P0.4): Lenth on the 15 published contrasts gives PSE 2.625, ME 6.75, SME 13.70 (fixture: published.lenth)');
});

describe('Montgomery Ex. 6.2, default model (reference fit)', () => {
  itMatchesReference(full);
});

describe('Montgomery Ex. 6.2, final model A, C, D, AC, AD (reference fit)', () => {
  itMatchesReference(final);
});
