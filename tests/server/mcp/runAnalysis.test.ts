// MCP tool run_analysis, called through the SDK client over InMemoryTransport.
// Known bugs pinned here are all fixed by P0.5: MCP-1 (model DF reported as the p-value),
// MCP-6 (Pareto ranking reads fields that do not exist), MCP-7 (exclusions by name ignored),
// MCP-8 (untestable lack of fit reported as adequate) and MCP-9 (crash on saturated designs
// with a 3-level categorical).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDemoCatalyticProject } from '../../../src/core/sampleProject';
import { fixtureProject, loadFixture } from '../../helpers/fixtures';
import { connectMcp } from '../../helpers/mcp';

const demo = createDemoCatalyticProject();
const demoRef = loadFixture('demo-suzuki-cross-coupling').reference.models[0]; // Yield
const unreplicated = fixtureProject(loadFixture('montgomery-ex6-2-filtration'));
const saturated = fixtureProject(loadFixture('factorial-2x3-saturated'));

let mcp: Awaited<ReturnType<typeof connectMcp>>;
beforeAll(async () => {
  mcp = await connectMcp([demo, unreplicated, saturated]);
});
afterAll(async () => {
  await mcp.close();
});

const round = (x: number, d: number) => Number(x.toFixed(d));

describe('MCP run_analysis', () => {
  it('demo project, Yield: R², adjusted R², RMSE and F match the reference fit (as rounded by the tool)', async () => {
    const { isError, json } = await mcp.callTool('run_analysis', { projectId: demo.id, responseId: 'Yield' });
    expect(isError).toBe(false);
    expect(json.summary.rSquared).toBe(round(demoRef.rSquared, 4));
    expect(json.summary.adjRSquared).toBe(round(demoRef.adjRSquared!, 4));
    expect(json.summary.rmse).toBe(round(demoRef.rmse!, 4));
    expect(json.summary.fRatio).toBe(round(demoRef.fRatio!, 3));
    expect(json.summary.runsAnalyzed).toBe(demoRef.n);
  });

  it('MCP-1 (P0.5): summary.pValue is the model p-value 1 − F_cdf(F; dfModel, dfError), not the model DF', async () => {
    const { json } = await mcp.callTool('run_analysis', { projectId: demo.id, responseId: 'Yield' });
    expect(json.summary.pValue).toBeCloseTo(demoRef.modelPValue!, 5);
    expect(json.summary.dfModel).toBe(demoRef.dfModel);
  });

  it('MCP-6 (P0.5): every paretoRanking item has the term name and a non-zero effect', async () => {
    const { json } = await mcp.callTool('run_analysis', { projectId: demo.id, responseId: 'Yield' });
    expect(json.paretoRanking.length).toBeGreaterThan(0);
    for (const item of json.paretoRanking) {
      expect(typeof item.term, 'term').toBe('string');
      expect(item.effectMagnitude, `${item.term} effectMagnitude`).toBeGreaterThan(0);
      expect(['Positive', 'Negative', 'Neutral']).toContain(item.direction);
      expect(typeof item.significant).toBe('boolean');
    }
  });

  it('MCP-7 (P0.5): excludedTerms given by name or reversed interaction removes that term and echoes applied exclusions', async () => {
    const { json } = await mcp.callTool('run_analysis', {
      projectId: demo.id,
      responseId: 'Yield',
      excludedTerms: ['Temperature', 'Catalyst Loading*Temperature'],
    });
    const termNames = json.modelTerms.map((t: any) => t.term);
    expect(termNames).not.toContain('Temperature');
    expect(termNames).not.toContain('Temperature*Catalyst Loading');
    expect(json.excludedTerms).toEqual(['Temperature', 'Temperature*Catalyst Loading']);
  });

  it('MCP-7 (P0.5): unknown term in excludedTerms returns an error listing valid terms', async () => {
    const { isError, text } = await mcp.callTool('run_analysis', {
      projectId: demo.id,
      responseId: 'Yield',
      excludedTerms: ['NotARealFactor'],
    });
    expect(isError).toBe(true);
    expect(text).toContain('NotARealFactor');
    expect(text).toContain('Temperature');
  });

  it('MCP-8 (P0.5): an unreplicated design reports lack of fit as not testable', async () => {
    const { json } = await mcp.callTool('run_analysis', { projectId: unreplicated.id });
    expect(json.lackOfFit.testable).toBe(false);
    expect(json.lackOfFit.pValue).toBeNull();
    expect(typeof json.lackOfFit.reason).toBe('string');
  });

  it('MCP-9 (P0.5): a saturated 2 × 3 factorial returns a result instead of an error', async () => {
    const { isError, text, json } = await mcp.callTool('run_analysis', { projectId: saturated.id });
    expect(isError, text).toBe(false);
    expect(json.summary.pValue).toBeNull();
    expect(json.lackOfFit.testable).toBe(false);
  });
});
