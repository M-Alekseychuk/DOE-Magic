// The single-response optimum in computeAnalysis (optimalConditions).
// STAT-4 (fixed by P0.8): the grid of {min, mid, max} per numeric factor is cut to the first 512
// combinations after each factor, so with 7 numeric factors the first factor never leaves its minimum.
// Synthetic data with a known answer: y = 10 + 5·x0 + 0.1·(x1 + … + x(k−1)) in coded units.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../../src/core/types';
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

  it.fails('STAT-4 (P0.8): 7 numeric factors: F0 is at its maximum', () => {
    expect(optimumOf(7).f0).toBe(100);
  });

  it.fails('STAT-4 (P0.8): 7 numeric factors: the expected y at the optimum is about 15.6', () => {
    expect(optimumOf(7).expectedY).toBeGreaterThan(14.9);
  });
});
