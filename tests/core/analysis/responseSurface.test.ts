// Montgomery (2013) Example 11.2: central composite design in 2 factors with 5 centre points.
// STAT-3 (fixed by P0.9): the engine's model has no quadratic terms, so it fits A, B, A*B and
// the curvature ends up in lack of fit. The fit it does make is checked against the reference;
// the published second-order model is the target for P0.9.
import { describe, expect, it } from 'vitest';
import { predictModelResponse } from '../../../src/core/analysis/analysisCore';
import { analyseFixture } from '../../helpers/fixtures';
import { estimateOf, expectClose, itMatchesReference } from '../../helpers/reference';

const fit = analyseFixture('montgomery-ex11-2-ccd');
const { result, project } = fit;
const pub = fit.fixture.published!;
const q = pub.quadraticModel as Record<string, number>;
// Natural units: x = (time − 85)/5, (temperature − 175)/5.
const natural = (x1: number, x2: number) => ({ A: 85 + 5 * x1, B: 175 + 5 * x2 });

describe('Montgomery Ex. 11.2, CCD: the model the engine fits today (A, B, A*B)', () => {
  itMatchesReference(fit);

  it('linear and interaction coefficients already match the published second-order model', () => {
    // In a rotatable CCD these columns are orthogonal to the missing x² columns.
    for (const id of ['A', 'B', 'A*B']) expectClose(estimateOf(result, id), q[id], `coefficient ${id}`, 0, 0.0005);
  });

  it('the missing curvature shows up as significant lack of fit', () => {
    expect(result.lackOfFit.p_lof).toBeLessThan(0.001);
  });
});

describe('Montgomery Ex. 11.2, CCD: STAT-3, no quadratic terms', () => {
  it.fails('STAT-3 (P0.9): the prediction at the centre equals the published intercept 79.94', () => {
    expectClose(predictModelResponse(result, natural(0, 0), project), q.Intercept, 'ŷ(centre)', 0, 0.005);
  });

  it.fails('STAT-3 (P0.9): the prediction at the published stationary point is 80.21', () => {
    const s = pub.stationaryPoint;
    expectClose(predictModelResponse(result, natural(s.A, s.B), project), s.yHat, 'ŷ(stationary point)', 0, 0.01);
  });

  it.fails('STAT-3 (P0.9): lack of fit is not significant once curvature is modelled', () => {
    expect(result.lackOfFit.p_lof).toBeGreaterThan(0.05);
  });

  it.todo('STAT-3 (P0.9): the quadratic coefficients match the published −1.376 (time²) and −1.001 (temperature²); needs the quadratic term IDs from design spec §4.2');
});
