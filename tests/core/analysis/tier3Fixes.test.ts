import { describe, expect, it } from 'vitest';
import { Project } from '../../../src/core/types';
import { createDemoCatalyticProject } from '../../../src/core/sampleProject';
import { computeAnalysis, predictModelResponse } from '../../../src/core/analysis/analysisCore';
import { surfaceGrid, defaultFixedFactorSettings, axisCoordToFactorSetting } from '../../../src/core/analysis/surfaceGrid';
import { countMeasuredValues, simulateSampleDataForResponse } from '../../../src/core/analysis/projectModels';
import { generateExportHTML } from '../../../src/web/features/export/htmlExport';
import { connectMcp } from '../../helpers/mcp';

describe('Tier 3 Fixes: P0.2, P0.5 (UI-31), P0.7, P0.10', () => {
  describe('P0.7 (MCP-2): simulate_robustness does not clamp negative or wide factor ranges', () => {
    const ranges: [number, number][] = [
      [-20, -10],
      [-80, -70],
      [10, 20],
    ];

    for (const [minVal, maxVal] of ranges) {
      it(`matches nominal prediction within 3 MC SEs and theoretical SD within 5% for range [${minVal}, ${maxVal}]`, async () => {
        const mid = (minVal + maxVal) / 2;
        const half = (maxVal - minVal) / 2;
        const slope = 4.0; // natural slope: y = 100 + 4 * x
        const intercept = 100;

        // 4-run design so OLS fits exact y = 100 + 4 * x with 0 RMSE
        const project: Project = {
          id: `proj-neg-${minVal}`,
          name: `Cryo Range [${minVal}, ${maxVal}]`,
          description: '',
          designType: 'factorial_2level',
          factors: [{ id: 'f1', name: 'Temp', type: 'numeric', min: minVal, max: maxVal, unit: 'C' }],
          responses: [{ id: 'r1', name: 'Yield', goal: 'maximize', unit: '%' }],
          runs: [
            { id: '1', runOrder: 1, stdOrder: 1, factors: { f1: minVal }, responses: { r1: intercept + slope * minVal } },
            { id: '2', runOrder: 2, stdOrder: 2, factors: { f1: maxVal }, responses: { r1: intercept + slope * maxVal } },
            { id: '3', runOrder: 3, stdOrder: 3, factors: { f1: minVal }, responses: { r1: intercept + slope * minVal } },
            { id: '4', runOrder: 4, stdOrder: 4, factors: { f1: maxVal }, responses: { r1: intercept + slope * maxVal } },
          ],
          createdAt: 1,
          updatedAt: 1,
        };

        const model = computeAnalysis(project, project.responses[0], [], 'maximize', undefined);
        expect(model).not.toBeNull();
        const expectedMean = predictModelResponse(model, { f1: mid }, project);
        expect(expectedMean).toBeCloseTo(intercept + slope * mid, 6);

        const factorSd = half * 0.2;
        const expectedSd = Math.abs(slope) * factorSd;
        const numSimulations = 10000;

        const mcp = await connectMcp([project]);
        try {
          const { isError, json, text } = await mcp.callTool('simulate_robustness', {
            projectId: project.id,
            responseId: 'Yield',
            nominalSettings: { Temp: mid },
            factorStdDevs: { Temp: factorSd },
            specLimits: { lsl: expectedMean - 3 * expectedSd, usl: expectedMean + 3 * expectedSd },
            numSimulations,
            includeResidualNoise: false,
          });
          expect(isError, text).toBe(false);

          const mcSe = expectedSd / Math.sqrt(numSimulations);
          expect(Math.abs(json.statistics.mean - expectedMean)).toBeLessThanOrEqual(3.5 * mcSe + 1e-3);
          expect(Math.abs(json.statistics.standardDeviation - expectedSd) / expectedSd).toBeLessThan(0.05);
        } finally {
          await mcp.close();
        }
      });
    }
  });

  describe('P0.10 (STAT-8, UI-4) & P0.5 (UI-31): surfaceGrid and HTML export use predictModelResponse and modelPValue', () => {
    it('surfaceGrid matches predictModelResponse at every grid point and produces a twisted (non-planar) surface for an interaction model', () => {
      const demo = createDemoCatalyticProject();
      const resp = demo.responses[0]; // Yield
      const res = computeAnalysis(demo, resp, resp.excludedTerms || [], resp.goal, resp.targetValue)!;

      const f1 = demo.factors[0]; // Temperature
      const f2 = demo.factors[1]; // Catalyst Loading
      const grid = surfaceGrid(res, demo, f1.id, f2.id, undefined, 11);
      expect(grid).not.toBeNull();

      const baseSettings = defaultFixedFactorSettings(demo);
      for (let i = 0; i < grid!.gridY.length; i++) {
        for (let j = 0; j < grid!.gridX.length; j++) {
          const settings = {
            ...baseSettings,
            [f1.id]: axisCoordToFactorSetting(f1, grid!.gridX[j]),
            [f2.id]: axisCoordToFactorSetting(f2, grid!.gridY[i]),
          };
          const expected = predictModelResponse(res, settings, demo);
          expect(grid!.zGrid[i][j]).toBeCloseTo(expected, 10);
        }
      }

      // Check non-planarity due to Temperature * Catalyst Loading interaction:
      // On a plane, z(high, high) - z(low, high) == z(high, low) - z(low, low).
      const n = grid!.gridX.length - 1;
      const slopeAtLowY = grid!.zGrid[0][n] - grid!.zGrid[0][0];
      const slopeAtHighY = grid!.zGrid[n][n] - grid!.zGrid[n][0];
      expect(Math.abs(slopeAtHighY - slopeAtLowY)).toBeGreaterThan(1.0);
    });

    it('generateExportHTML embeds surfaceGrids and modelPValue (not p=14.0000) and removes predictSurrogate', () => {
      const demo = createDemoCatalyticProject();
      const html = generateExportHTML(demo, 'en');

      expect(html).not.toContain('predictSurrogate');
      expect(html).not.toContain('getTrend');
      expect(html).toContain('surfaceGrids');
      expect(html).toContain('data.modelPValue');
      expect(html).not.toContain('data.p.toFixed(4)');
    });
  });

  describe('P0.2 (DES-1, UI-2, MCP-10): protect measured values on design regeneration and sample simulation', () => {
    it('simulateSampleDataForResponse fills only empty cells and never overwrites recorded measurements', () => {
      const demo = createDemoCatalyticProject();
      const respId = demo.responses[0].id;

      // Clear 3 runs and keep the rest with known sentinel measurements
      demo.runs.forEach((r, idx) => {
        r.responses[respId] = idx < 3 ? null : 999.123;
      });

      expect(countMeasuredValues(demo, respId)).toBe(demo.runs.length - 3);

      const { runs: updatedRuns, filledCount, preservedCount } = simulateSampleDataForResponse(demo, respId);
      expect(filledCount).toBe(3);
      expect(preservedCount).toBe(demo.runs.length - 3);

      updatedRuns.forEach((r, idx) => {
        if (idx < 3) {
          expect(typeof r.responses[respId]).toBe('number');
          expect(r.responses[respId]).not.toBe(999.123);
        } else {
          expect(r.responses[respId]).toBe(999.123);
        }
      });
    });

    it('MCP generate_doe_design refuses when measured values exist unless force: true, and respects centerPoints: 0', async () => {
      const demo = createDemoCatalyticProject();
      const initialMeasured = countMeasuredValues(demo);
      expect(initialMeasured).toBeGreaterThan(0);

      const mcp = await connectMcp([demo]);
      try {
        // 1. Without force: true -> refuses and keeps runs intact
        const refused = await mcp.callTool('generate_doe_design', {
          projectId: demo.id,
          designType: 'factorial_2level',
        });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('Refusing to regenerate design');
        expect(countMeasuredValues(demo)).toBe(initialMeasured);

        // 2. With force: true and centerPoints: 0 -> succeeds, reports discardedValuesCount, and has 0 center points
        demo.factors = demo.factors.filter((f) => f.type === 'numeric'); // 3 numeric factors -> 2^3 = 8 runs with 0 center points
        const forced = await mcp.callTool('generate_doe_design', {
          projectId: demo.id,
          designType: 'factorial_2level',
          centerPoints: 0,
          force: true,
        });
        expect(forced.isError, forced.text).toBe(false);
        expect(forced.json.discardedValuesCount).toBe(initialMeasured);
        expect(forced.json.runsCount).toBe(8);
        expect(demo.centerPoints).toBe(0);
      } finally {
        await mcp.close();
      }
    });
  });
});
