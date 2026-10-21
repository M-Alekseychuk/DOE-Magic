// Saturated, unreplicated models (error DF = 0), where the engine switches to Lenth's method.
// Montgomery (2013) Example 8.1 (2^(4-1), D = ABC) and a synthetic 2 × 3 factorial.
// Known bugs pinned here: STAT-2 (Lenth scale and pool), STAT-5 (SE 0, zero-width intervals,
// undefined reference rows) and STAT-21 (Box-Cox on an exact fit). All are fixed by P0.4.
import { describe, expect, it } from 'vitest';
import { analyse, analyseFixture } from '../../helpers/fixtures';
import { checkCoefficients, checkFitted, checkLackOfFit, checkLeverageInvariants, estimateOf, expectClose } from '../../helpers/reference';

const half = analyseFixture('montgomery-ex8-1-half-fraction');
const { result, ref, project } = half;
const pub = half.fixture.published!;
const lenthT = ref.lenth!.t; // |effect| / PSE per estimable column, PSE = 24.75

describe('Montgomery Ex. 8.1, saturated 2^(4-1) (published values)', () => {
  it('effects of the 7 estimable contrasts match the published estimates', () => {
    for (const [id, effect] of Object.entries(pub.effects as Record<string, number>)) {
      expectClose(2 * estimateOf(result, id), effect, `effect ${id}`);
    }
  });

  it('the later term of each alias pair (BC, BD, CD) is flagged as aliased', () => {
    const aliased = (result.effectSummary as any[]).filter((e) => e.isAliased).map((e) => e.id).sort();
    expect(aliased).toEqual([...pub.aliasedTerms].sort());
  });

  it('the reference Lenth PSE equals the published-effect value 24.75', () => {
    expectClose(ref.lenth!.PSE, pub.lenth.PSE, 'PSE');
  });
});

describe('Montgomery Ex. 8.1, saturated 2^(4-1) (reference fit)', () => {
  it('has rank 8 and error DF 0', () => {
    expect(result.p).toBe(ref.dfModel);
    expect(result.dfError).toBe(0);
  });

  it('coefficients and fitted values match the reference fit', () => {
    checkCoefficients(result, ref);
    checkFitted(result, ref);
  });

  it('every leverage is 1 and lack of fit is not testable', () => {
    checkLeverageInvariants(result, ref.rank);
    checkLackOfFit(result, ref);
  });

  it.fails('STAT-2 (P0.4): Pareto and half-normal t ratios equal |effect| / PSE (Lenth 1989)', () => {
    for (const p of result.paretoData as any[]) expectClose(p.tRatio, lenthT[p.name], `Pareto t ${p.name}`);
    for (const p of result.halfNormalData as any[]) expectClose(p.tRatio, lenthT[p.name], `half-normal t ${p.name}`);
  });

  it.fails('STAT-2 (P0.4): the effect-test F of each 1-df term equals the Lenth t squared', () => {
    for (const e of (result.effectSummary as any[]).filter((x) => !x.isAliased)) {
      const name = e.name as string;
      expectClose(e.fRatio, lenthT[name] ** 2, `F ${name}`);
    }
  });

  it.fails('STAT-2 (P0.4): excluding an already aliased term (C*D) leaves the Lenth t ratios unchanged', () => {
    const excluded = analyse(project, 'y', ['C*D']);
    for (const p of excluded.paretoData as any[]) expectClose(p.tRatio, lenthT[p.name], `Pareto t ${p.name}`);
  });

  it.fails('STAT-5 (P0.4): no parameter estimate reports a standard error of 0', () => {
    for (const r of (result.parameterEstimates as any[]).filter((x) => !x.isAliased)) {
      expect(r.stdError === null || r.stdError > 0, `${r.term} stdError = ${r.stdError}`).toBe(true);
    }
  });

  it.fails('STAT-5 (P0.4): the confidence and prediction intervals at the optimum are null or have positive width', () => {
    const o = result.optimalConditions;
    expect(o.ciLower === null || o.ciUpper > o.ciLower, `CI [${o.ciLower}, ${o.ciUpper}]`).toBe(true);
    expect(o.piLower === null || o.piUpper > o.piLower, `PI [${o.piLower}, ${o.piUpper}]`).toBe(true);
  });

  it.fails('STAT-21 (P0.4): Box-Cox is null for an exact fit', () => {
    expect(result.boxCox).toBeNull();
  });
});

describe('2 × 3 factorial with a 3-level categorical, saturated', () => {
  const sat = analyseFixture('factorial-2x3-saturated');

  it('coefficients and fitted values match the reference fit', () => {
    expect(sat.result.dfError).toBe(0);
    checkCoefficients(sat.result, sat.ref);
    checkFitted(sat.result, sat.ref);
  });

  it.fails('STAT-5 (P0.4): the reference-level row (Catalyst[Cu]) uses null, never undefined', () => {
    const refRow = (sat.result.parameterEstimates as any[]).find((r) => r.isReference);
    expect(refRow).toBeDefined();
    for (const key of ['stdError', 'tRatio', 'pVal']) expect(refRow[key], `${key}`).not.toBeUndefined();
  });
});
