// Montgomery (2013) Example 11.2: central composite design in 2 factors with 5 centre points.
// STAT-3 & DES-4 (fixed by P0.9): the engine's model includes quadratic terms (A^2, B^2) for
// response-surface designs, and the D-optimal selector includes quadratic columns when
// 3+-level numeric factors are present.
import { describe, expect, it } from 'vitest';
import { predictModelResponse } from '../../../src/core/analysis/analysisCore';
import { generateDOptimalSubset } from '../../../src/core/design/dOptimal';
import { analyse, analyseFixture } from '../../helpers/fixtures';
import { estimateOf, expectClose, itMatchesReference } from '../../helpers/reference';

const fit = analyseFixture('montgomery-ex11-2-ccd');
const { result, project, ref } = fit;
const reduced2FI = analyse(project, 'y', ['A^2', 'B^2']);
const pub = fit.fixture.published!;
const q = pub.quadraticModel as Record<string, number>;
// Natural units: x = (time − 85)/5, (temperature − 175)/5.
const natural = (x1: number, x2: number) => ({ A: 85 + 5 * x1, B: 175 + 5 * x2 });

describe('Montgomery Ex. 11.2, CCD: the reduced 2FI model (A, B, A*B)', () => {
  itMatchesReference({ result: reduced2FI, ref });

  it('linear and interaction coefficients match the published second-order model', () => {
    // In a rotatable CCD these columns are orthogonal to the x² columns.
    for (const id of ['A', 'B', 'A*B']) expectClose(estimateOf(reduced2FI, id), q[id], `coefficient ${id}`, 0, 0.0005);
  });

  it('the missing curvature shows up as significant lack of fit when quadratics are excluded', () => {
    expect(reduced2FI.lackOfFit.p_lof).toBeLessThan(0.001);
  });
});

describe('Montgomery Ex. 11.2, CCD: STAT-3, second-order quadratic model', () => {
  it('STAT-3 (P0.9): the prediction at the centre equals the published intercept 79.94', () => {
    expectClose(predictModelResponse(result, natural(0, 0), project), q.Intercept, 'ŷ(centre)', 0, 0.005);
  });

  it('STAT-3 (P0.9): the prediction at the published stationary point is 80.21', () => {
    const s = pub.stationaryPoint;
    expectClose(predictModelResponse(result, natural(s.A, s.B), project), s.yHat, 'ŷ(stationary point)', 0, 0.01);
  });

  it('STAT-3 (P0.9): lack of fit is not significant once curvature is modelled', () => {
    expect(result.lackOfFit.p_lof).toBeGreaterThan(0.05);
  });

  it('STAT-3 (P0.9): the quadratic coefficients match the published −1.376 (time²) and −1.001 (temperature²)', () => {
    expectClose(estimateOf(result, 'A^2'), q['A^2'], 'coefficient A^2', 0, 0.001);
    expectClose(estimateOf(result, 'B^2'), q['B^2'], 'coefficient B^2', 0, 0.001);
  });

  it('STAT-3 (P0.9): the interior stationary optimum is found by the optimum search', () => {
    expectClose(result.optimalConditions.expectedY, pub.stationaryPoint.yHat, 'optimal expectedY', 0, 0.02);
  });

  it('STAT-3 (P0.9): on a 2^k + centre-point design forced into RSM mode, one quadratic column is estimable and the others are flagged as aliased', () => {
    const half3cp = analyseFixture('half-fraction-2x4-1-3cp');
    const rsmProject = { ...half3cp.project, designType: 'ccd' as const };
    const rsmFit = analyse(rsmProject, 'y');
    const quadSummaries = (rsmFit.effectSummary as any[]).filter((e) => e.id.endsWith('^2'));
    expect(quadSummaries).toHaveLength(4);
    expect(quadSummaries.filter((e) => !e.isAliased)).toHaveLength(1);
    expect(quadSummaries.filter((e) => e.isAliased)).toHaveLength(3);
  });

  it('DES-4 (P0.9): a 5-factor, 12-run 3-level D-optimal design keeps mid-level points for every factor so all 5 quadratic terms are estimable', () => {
    const factors = ['A', 'B', 'C', 'D', 'E'].map((id) => ({
      id,
      name: id,
      type: 'numeric' as const,
      min: -1,
      max: 1,
      unit: '',
    }));
    // Build the 3^5 = 243 candidate grid
    let candidates: Record<string, number>[] = [{}];
    for (const f of factors) {
      const next: Record<string, number>[] = [];
      for (const c of candidates) {
        for (const v of [-1, 0, 1]) next.push({ ...c, [f.id]: v });
      }
      candidates = next;
    }
    const { selectedIndices } = generateDOptimalSubset(candidates, factors, 12);
    const chosen = selectedIndices.map((idx) => candidates[idx]);
    for (const f of factors) {
      const hasMid = chosen.some((r) => r[f.id] === 0);
      expect(hasMid, `factor ${f.id} has mid-level run`).toBe(true);
    }
  });
});
