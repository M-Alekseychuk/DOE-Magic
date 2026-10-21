// The demo project shipped in src/core/sampleProject.ts (27 runs, 3 numeric factors and a
// 3-level categorical, two responses). Its default models are full rank with pure error, so
// they are checked against the reference fit, and today's whole output is kept as a
// characterization snapshot (__snapshots__/demoProject.test.ts.snap).
// The snapshot includes values that are known to be wrong or misnamed, for example `p` (the model
// DF, MCP-1), `paretoThreshold` (unused, STAT-25), √F as the t ratio of multi-df terms (STAT-20)
// and raw max − min categorical effects (STAT-15). A PR that changes engine output on purpose
// updates the snapshot with `npx vitest run -u` and explains every changed number.
import { describe, expect, it } from 'vitest';
import { createDemoCatalyticProject } from '../../../src/core/sampleProject';
import { analyse, loadFixture, type Analysis } from '../../helpers/fixtures';
import { itMatchesReference } from '../../helpers/reference';

const project = createDemoCatalyticProject();
const fixture = loadFixture('demo-suzuki-cross-coupling');

// Numbers rounded to 9 significant digits (and |x| < 1e-15 to 0), so the snapshot does not depend
// on the last bits of floating point. Functions and factor objects are left out.
function round(v: unknown): unknown {
  if (typeof v === 'number') return Number.isFinite(v) ? (Math.abs(v) < 1e-15 ? 0 : Number(v.toPrecision(9))) : v;
  if (Array.isArray(v)) return v.map(round);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
  return v;
}

const pick = <T extends Record<string, any>>(o: T, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

function characterize(r: Analysis) {
  const { factors, ...optimum } = r.optimalConditions;
  return round({
    summary: pick(r, ['nRuns', 'p', 'dfError', 'rSquared', 'adjRSquared', 'rmse', 'mse', 'fRatio', 'adequatePrecision',
      'tLimitPareto', 'bonferroniLimitPareto', 'paretoThreshold', 'bestPred']),
    lackOfFit: r.lackOfFit,
    parameterEstimates: (r.parameterEstimates as any[]).map((x) => pick(x, ['term', 'estimate', 'stdError', 'tRatio', 'pVal', 'vif', 'isAliased', 'isReference'])),
    effectSummary: (r.effectSummary as any[]).map((x) => pick(x, ['id', 'name', 'df', 'ss', 'fRatio', 'pVal', 'logworth', 'isAliased', 'isExcluded'])),
    effects: (r.effects as any[]).map((x) => pick(x, ['id', 'effect', 'direction', 'lowAvg', 'highAvg', 'centerAvg', 'levelAverages', 'isAliased', 'isExcluded'])),
    paretoData: (r.paretoData as any[]).map((x) => pick(x, ['name', 'absEffect', 'direction', 'tRatio'])),
    halfNormalData: (r.halfNormalData as any[]).map((x) => pick(x, ['name', 'tRatio', 'expected', 'significant'])),
    halfNormalLine: r.halfNormalLine,
    studentizedResiduals: r.studentizedResiduals,
    optimalConditions: { ...optimum, factors: (factors as any[]).map(({ factor, ...f }) => ({ id: factor.id, ...f })) },
    boxCox: r.boxCox && pick(r.boxCox, ['shift', 'optimalLambda', 'ciLow', 'ciHigh', 'isOneInCi', 'recommendedLambda', 'maxLogL']),
  });
}

describe('demo project proj-suzuki-cross-coupling', () => {
  it('the fixture copy of the demo data still matches src/core/sampleProject.ts', () => {
    expect(fixture.factors).toEqual(project.factors);
    expect(fixture.runs.map((r) => ({ factors: r.factors, responses: r.responses })))
      .toEqual(project.runs.map((r) => ({ factors: r.factors, responses: r.responses })));
  });

  fixture.models.forEach((model, i) => {
    const result = analyse(project, model.responseId, model.excludedTerms);
    const ref = fixture.reference.models[i];

    describe(`${model.name} (reference fit)`, () => {
      itMatchesReference({ result, ref });
    });

    it(`${model.name}: characterization snapshot of today's output`, () => {
      expect(characterize(result)).toMatchSnapshot();
    });
  });
});
