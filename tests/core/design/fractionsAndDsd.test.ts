import { describe, expect, it } from 'vitest';
import type { Factor, Response } from '../../../src/core/types';
import { designMatrix } from '../../../src/core/design/designMatrixData';
import { computeFractionResolution, buildRegularFraction } from '../../../src/core/design/fractions';
import { buildDSD } from '../../../src/core/design/dsd';
import { generateDesign } from '../../../src/core/design/doeGenerator';

function makeNumericFactors(k: number): Factor[] {
  return Array.from({ length: k }, (_, i) => ({
    id: `F${i + 1}`,
    name: `F${i + 1}`,
    type: 'numeric' as const,
    min: 0,
    max: 100,
    unit: '',
  }));
}

const dummyResponses: Response[] = [{ id: 'R1', name: 'Yield', unit: '%', goal: 'maximize' }];

function codedColumn(runs: { factors: Record<string, string | number> }[], f: Factor): number[] {
  const mid = (f.min + f.max) / 2;
  const half = (f.max - f.min) / 2;
  return runs.map(r => (Number(r.factors[f.id]) - mid) / half);
}

function pearsonAbs(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA < 1e-12 || denB < 1e-12) return 0;
  return Math.abs(num / Math.sqrt(denA * denB));
}

describe('DES-2 / DES-10 / DES-17 (P0.11): regular 2^(k-p) fractional factorials and resolution table', () => {
  it('every cell in designMatrixData matches its computed defining-relation resolution and uses a legended colour', () => {
    const validColors = new Set(['R', 'Y', 'G']);
    for (const [runsKey, factorMap] of Object.entries(designMatrix)) {
      const runs = Number(runsKey);
      for (const [factorsKey, cell] of Object.entries(factorMap as Record<string, { p: string; res: string; color: string }>)) {
        const k = Number(factorsKey);
        expect(k).toBeGreaterThanOrEqual(3);
        expect(k).toBeLessThanOrEqual(16);
        expect(validColors.has(cell.color)).toBe(true);

        const { resolutionRoman, resolutionNumber } = computeFractionResolution(runs, k);
        expect(resolutionRoman).toBe(cell.res);
        expect(resolutionNumber).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('4 factors in 8 runs is Resolution IV (no main effect correlates with any 2FI)', () => {
    const factors = makeNumericFactors(4);
    const res = generateDesign(factors, dummyResponses, 'factorial_2level', { targetRuns: 8, centerPoints: 0 });
    expect(res.runs).toHaveLength(8);
    expect(res.designName).toContain('Resolution IV');

    const mainCols = factors.map(f => codedColumn(res.runs, f));
    // Main effects mutually orthogonal
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(pearsonAbs(mainCols[i], mainCols[j])).toBeLessThan(1e-12);
      }
    }
    // Main effects orthogonal to all 2FIs
    for (let m = 0; m < 4; m++) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const intCol = mainCols[i].map((v, r) => v * mainCols[j][r]);
          expect(pearsonAbs(mainCols[m], intCol)).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('5 factors in 16 runs is Resolution V and 6 factors in 32 runs is Resolution VI (main effects and 2FIs all mutually orthogonal)', () => {
    for (const [k, runs, expectedRes] of [[5, 16, 'V'], [6, 32, 'VI']] as const) {
      const factors = makeNumericFactors(k);
      const res = generateDesign(factors, dummyResponses, 'factorial_2level', { targetRuns: runs, centerPoints: 0 });
      expect(res.runs).toHaveLength(runs);
      expect(res.designName).toContain(`Resolution ${expectedRes}`);

      const mainCols = factors.map(f => codedColumn(res.runs, f));
      const allCols: number[][] = [...mainCols];
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          allCols.push(mainCols[i].map((v, r) => v * mainCols[j][r]));
        }
      }
      for (let a = 0; a < allCols.length; a++) {
        for (let b = a + 1; b < allCols.length; b++) {
          expect(pearsonAbs(allCols[a], allCols[b])).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('non-regular run counts fall back to D-Optimal Subset Design and are never called Resolution-optimized', () => {
    const factors = makeNumericFactors(4);
    const res = generateDesign(factors, dummyResponses, 'factorial_2level', { targetRuns: 10, centerPoints: 0 });
    expect(res.runs).toHaveLength(10);
    expect(res.designName).toBe('D-Optimal Subset Design');
    expect(res.notes).not.toContain('Resolution-optimized');
    expect( buildRegularFraction(factors, dummyResponses, 10, 0) ).toBeNull();
  });
});

describe('DES-3 (P0.12): real Definitive Screening Designs (DSD) from conference matrices', () => {
  it('continuous DSDs for m = 3..10 have orthogonal main effects, and main effects orthogonal to all 2FIs and quadratics', () => {
    for (const m of [3, 4, 5, 6, 7, 8, 9, 10]) {
      const factors = makeNumericFactors(m);
      const res = generateDesign(factors, dummyResponses, 'dsd', { centerPoints: 1 });
      const expectedOrder = m % 2 === 0 ? m : m + 1;
      expect(res.runs).toHaveLength(2 * expectedOrder + 1);
      expect(res.designName).toBe('Definitive Screening Design (DSD)');

      const mainCols = factors.map(f => codedColumn(res.runs, f));
      // Main effects mutually orthogonal
      for (let i = 0; i < m; i++) {
        for (let j = i + 1; j < m; j++) {
          expect(pearsonAbs(mainCols[i], mainCols[j])).toBeLessThan(1e-12);
        }
      }
      // Main effects orthogonal to all 2FIs and pure quadratics
      for (let idx = 0; idx < m; idx++) {
        for (let i = 0; i < m; i++) {
          const quadCol = mainCols[i].map(v => v * v);
          expect(pearsonAbs(mainCols[idx], quadCol)).toBeLessThan(1e-12);
          for (let j = i + 1; j < m; j++) {
            const intCol = mainCols[i].map((v, r) => v * mainCols[j][r]);
            expect(pearsonAbs(mainCols[idx], intCol)).toBeLessThan(1e-12);
          }
        }
      }
    }
  });

  it('DSD with 2-level categorical retains 3 levels on every continuous factor and orthogonal continuous main effects', () => {
    const factors: Factor[] = [
      ...makeNumericFactors(4),
      { id: 'Cat1', name: 'Solvent', type: 'categorical', min: 0, max: 1, unit: '', levels: ['EtOH', 'MeOH'] },
    ];
    const res = buildDSD(factors, dummyResponses, 1);
    expect(res.designName).toBe('Definitive Screening Design (DSD)');
    for (let i = 0; i < 4; i++) {
      const col = codedColumn(res.runs, factors[i]);
      expect(new Set(col)).toEqual(new Set([-1, 0, 1]));
      for (let j = i + 1; j < 4; j++) {
        const colJ = codedColumn(res.runs, factors[j]);
        expect(pearsonAbs(col, colJ)).toBeLessThan(1e-12);
      }
    }
  });

  it('3+ level categoricals fall back to a design explicitly labelled D-Optimal (not DSD)', () => {
    const factors: Factor[] = [
      ...makeNumericFactors(3),
      { id: 'Cat3', name: 'CatalystType', type: 'categorical', min: 0, max: 2, unit: '', levels: ['A', 'B', 'C'] },
    ];
    const res = buildDSD(factors, dummyResponses, 1);
    expect(res.designName).toContain('D-Optimal');
    expect(res.designName).not.toBe('Definitive Screening Design (DSD)');
  });
});
