// The single-response optimum in computeAnalysis (optimalConditions).
// STAT-4 (fixed by P0.8): the grid of {min, mid, max} per numeric factor was previously cut to the first 512
// combinations after each factor, so with 7 numeric factors the first factor never left its minimum.
// Synthetic data with a known answer: y = 10 + 5·x0 + 0.1·(x1 + … + x(k−1)) in coded units.
import { describe, expect, it } from 'vitest';
import type { Project, Factor } from '../../../src/core/types';
import { optimizeFactorBox, buildCompleteSearchCandidates } from '../../../src/core/optimization/optimize';
import { analyse } from '../../helpers/fixtures';

function twoLevelProject(k: number): Project {
  const factors = Array.from({ length: k }, (_, i) => ({ id: `F${i}`, name: `F${i}`, type: 'numeric' as const, min: 0, max: 100, unit: '' }));
  const runs = Array.from({ length: 2 ** k }, (_, r) => {
    const coded = factors.map((_, i) => ((r >> i) & 1 ? 1 : -1));
    const y = 10 + 5 * coded[0] + 0.1 * coded.slice(1).reduce((a, b) => a + b, 0) + 0.01 * ((r % 5) - 2);
    return {
      id: `run-${r + 1}`, runOrder: r + 1, stdOrder: r + 1,
      factors: Object.fromEntries(factors.map((f, i) => [f.id, coded[i] > 0 ? f.max : f.min])),
      responses: { y },
    };
  });
  return {
    id: `synthetic-2^${k}`, name: `2^${k} full factorial`, description: 'synthetic', factors, runs,
    responses: [{ id: 'y', name: 'Y', goal: 'maximize', unit: '' }], createdAt: 0, updatedAt: 0,
  };
}

function optimumOf(k: number) {
  const o = analyse(twoLevelProject(k), 'y').optimalConditions;
  return { f0: o.factors.find((f: any) => f.factor.id === 'F0')!.optimalValue, expectedY: o.expectedY as number };
}

describe('single-response optimum, maximize y with a strong F0 effect', () => {
  it('5 numeric factors: F0 is at its maximum (control)', () => {
    const o = optimumOf(5);
    expect(o.f0).toBe(100);
    expect(o.expectedY).toBeGreaterThan(14.9);
  });

  it('STAT-4 (P0.8): 7 numeric factors: F0 is at its maximum', () => {
    expect(optimumOf(7).f0).toBe(100);
  });

  it('STAT-4 (P0.8): 7 numeric factors: the expected y at the optimum is about 15.6', () => {
    expect(optimumOf(7).expectedY).toBeGreaterThan(14.9);
  });

  it('P0.8: every candidate contains every factor id, and same seed gives identical output', () => {
    const factors: Factor[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `N${i}`,
        name: `N${i}`,
        type: 'numeric' as const,
        min: -10,
        max: 10,
        unit: '',
      })),
      { id: 'C0', name: 'C0', type: 'categorical' as const, min: 0, max: 2, unit: '', levels: ['A', 'B', 'C'] },
      { id: 'C1', name: 'C1', type: 'categorical' as const, min: 0, max: 1, unit: '', levels: ['Low', 'High'] },
    ];

    const start = Date.now();
    const evalFn = (settings: Record<string, string | number>) => {
      for (const f of factors) {
        expect(settings).toHaveProperty(f.id);
        expect(settings[f.id]).toBeDefined();
      }
      const nSum = Array.from({ length: 10 }, (_, i) => (i + 1) * Number(settings[`N${i}`])).reduce((a, b) => a + b, 0);
      const cBonus = (settings.C0 === 'C' ? 50 : 0) + (settings.C1 === 'High' ? 25 : 0);
      const y_hat = nSum + cBonus;
      return { score: y_hat, d: 1, y_hat };
    };

    const res1 = optimizeFactorBox(factors, evalFn, { seed: 42 });
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(500);

    const res2 = optimizeFactorBox(factors, evalFn, { seed: 42 });
    expect(res1.bestSettings).toEqual(res2.bestSettings);
    expect(res1.bestScore).toBe(res2.bestScore);
    for (let i = 0; i < 10; i++) {
      expect(res1.bestSettings[`N${i}`]).toBe(10);
    }
    expect(res1.bestSettings.C0).toBe('C');
    expect(res1.bestSettings.C1).toBe('High');

    const mcpCands = buildCompleteSearchCandidates(factors, 10, 500);
    for (const c of mcpCands) {
      for (const f of factors) {
        expect(c[f.id]).toBeDefined();
      }
    }
  });

  it('P0.8: finds the interior optimum of a quadratic test function', () => {
    const factors: Factor[] = [
      { id: 'X1', name: 'X1', type: 'numeric', min: 0, max: 10, unit: '' },
      { id: 'X2', name: 'X2', type: 'numeric', min: 0, max: 10, unit: '' },
    ];
    // Peak at (X1 = 3.5, X2 = 6.25) with value 100
    const res = optimizeFactorBox(
      factors,
      (s) => {
        const x1 = Number(s.X1);
        const x2 = Number(s.X2);
        const y_hat = 100 - 2 * (x1 - 3.5) ** 2 - 3 * (x2 - 6.25) ** 2;
        return { score: y_hat, d: y_hat / 100, y_hat };
      },
      { refineContinuous: true }
    );
    expect(Number(res.bestSettings.X1)).toBeCloseTo(3.5, 2);
    expect(Number(res.bestSettings.X2)).toBeCloseTo(6.25, 2);
    expect(res.bestPred).toBeCloseTo(100, 2);
  });
});
