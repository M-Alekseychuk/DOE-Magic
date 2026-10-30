// The whole-model F test p-value. Today computeAnalysis has none: its field `p` is the model DF
// (design spec §4.2), which MCP run_analysis reports as `summary.pValue` (MCP-1) and the HTML
// report prints as "Model p-value" (UI-31). P0.5 adds `dfModel` and `modelPValue` to core;
// the MCP side is pinned in tests/server/mcp/runAnalysis.test.ts.
import { describe, expect, it } from 'vitest';
import { analyseFixture } from '../../helpers/fixtures';
import { expectClose } from '../../helpers/reference';

const CASES: [string, number][] = [
  ['montgomery-ex6-1-plasma-etch', 0],
  ['montgomery-ex6-2-filtration', 1],
  ['demo-suzuki-cross-coupling', 0],
  ['demo-suzuki-cross-coupling', 1],
];

describe('model p-value', () => {
  for (const [id, index] of CASES) {
    const { result, ref } = analyseFixture(id, index);
    it(`MCP-1/UI-31 (P0.5): ${id} / ${ref.name}: modelPValue = 1 − F_cdf(F; dfModel, dfError)`, () => {
      const r = result as Record<string, any>;
      expect(r.dfModel, 'dfModel').toBe(ref.dfModel);
      expectClose(r.modelPValue, ref.modelPValue!, 'modelPValue', 1e-6, 1e-12);
    });
  }

  it('MCP-1/UI-31 (P0.5): modelPValue is null when error DF = 0 (Montgomery Ex. 8.1)', () => {
    const { result } = analyseFixture('montgomery-ex8-1-half-fraction');
    expect((result as Record<string, any>).modelPValue).toBeNull();
  });
});
