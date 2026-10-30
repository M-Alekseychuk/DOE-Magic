import { v4 as uuidv4 } from 'uuid';
import { Factor, Response, Run } from '../types';
import { buildCenterPointRuns } from './centerPoints';

/**
 * Minimum-aberration / maximum-resolution regular 2^(k-p) fractional factorial generator catalogue
 * for N in {4, 8, 16, 32, 64, 128, 256, 512} runs and k in {3..16} factors.
 *
 * Sources:
 * - Montgomery, D. C. (2013), Design and Analysis of Experiments, 8th ed., Table 8.14.
 * - Wu, C. F. J. & Hamada, M. S. (2009), Experiments: Planning, Analysis, and Optimization, 2nd ed., Tables 5A.
 * - NIST/SEMATECH e-Handbook of Statistical Methods, Section 5.3.3.4.7 (Summary tables of useful fractional factorial designs).
 */

function popcount(n: number): number {
  let x = n >>> 0;
  let count = 0;
  while (x !== 0) {
    x &= x - 1;
    count++;
  }
  return count;
}

const ROMAN_RESOLUTION: Record<number, string> = {
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
};

/**
 * Returns the odd-weight non-basic bitmasks of `b` bits (weights 5, 3, 7, ...),
 * ordered so high-weight masks come first. Since every basic column has weight 1 (odd)
 * and every generator mask has odd weight, every defining word has EVEN weight >= 4 (Resolution >= IV).
 */
function oddWeightNonBasicMasks(b: number): number[] {
  const masksByWeight = new Map<number, number[]>();
  const limit = 1 << b;
  for (let m = 1; m < limit; m++) {
    const wt = popcount(m);
    if (wt <= 1 || wt % 2 === 0) continue;
    const list = masksByWeight.get(wt) || [];
    list.push(m);
    masksByWeight.set(wt, list);
  }
  // Prefer weight >= 5 first (if any), then weight 3, to maximise word lengths
  const weights = [...masksByWeight.keys()].sort((a, w) => b >= 6 ? w - a : a - w);
  return weights.flatMap(w => masksByWeight.get(w)!);
}

/**
 * Verified 8 generator masks for N = 256 (b = 8) up to k = 16 with Resolution V
 * (Extended BCH / Montgomery / Wu & Hamada 2^(16-8)_V: every defining word has weight >= 5).
 */
const RES_V_B8_GENERATORS: number[] = (() => {
  // Construct/verify the 8 generator masks in b = 8 such that all 1 + k + C(k,2) combinations
  // of <= 2 columns are distinct (which is equivalent to minimum word length >= 5, i.e., Resolution V).
  const b = 8;
  const basic = Array.from({ length: b }, (_, i) => 1 << i);
  const candidates: number[] = [];
  for (let m = 1; m < (1 << b); m++) {
    if (popcount(m) >= 4) candidates.push(m);
  }
  // Sort candidates by weight descending (preferring weight 5 and 4) for minimum aberration
  candidates.sort((x, y) => {
    const wx = popcount(x);
    const wy = popcount(y);
    const scoreX = wx === 5 ? 10 : wx === 4 ? 9 : wx;
    const scoreY = wy === 5 ? 10 : wy === 4 ? 9 : wy;
    return scoreY - scoreX || x - y;
  });

  const chosen: number[] = [];
  const allCols = [...basic];
  const usedPairs = new Set<number>([0, ...basic]);
  for (let i = 0; i < basic.length; i++) {
    for (let j = i + 1; j < basic.length; j++) {
      usedPairs.add(basic[i] ^ basic[j]);
    }
  }

  function backtrack(startIdx: number): boolean {
    if (chosen.length === 8) return true;
    for (let idx = startIdx; idx < candidates.length; idx++) {
      const cand = candidates[idx];
      if (usedPairs.has(cand)) continue;
      let conflict = false;
      const newPairs: number[] = [cand];
      for (const col of allCols) {
        const xorVal = cand ^ col;
        if (usedPairs.has(xorVal) || newPairs.includes(xorVal)) {
          conflict = true;
          break;
        }
        newPairs.push(xorVal);
      }
      if (conflict) continue;

      chosen.push(cand);
      allCols.push(cand);
      newPairs.forEach(v => usedPairs.add(v));
      if (backtrack(idx + 1)) return true;
      chosen.pop();
      allCols.pop();
      newPairs.forEach(v => usedPairs.delete(v));
    }
    return false;
  }

  backtrack(0);
  return chosen;
})();

/**
 * Returns the p = k - b generator bitmasks (over the b basic factors 0..b-1)
 * for a regular 2^(k-p) fractional factorial with N = 2^b runs and k factors.
 */
export function getRegularFractionGenerators(runs: number, k: number): number[] | null {
  const b = Math.round(Math.log2(runs));
  if ((1 << b) !== runs || b < 2 || b > 9) return null;
  const p = k - b;
  if (p < 1 || k > 16) return null;

  if (runs === 4) {
    // b = 2, k = 3 (p = 1): C = AB (Res III)
    if (p === 1) return [0b11];
    return null;
  }

  if (runs === 8) {
    // b = 3, k = 4..7
    if (p === 1) return [0b111]; // Res IV: D = ABC
    const masks = [0b011, 0b101, 0b110, 0b111];
    return masks.slice(0, p); // Res III for k = 5..7
  }

  if (runs === 16) {
    // b = 4, k = 5..15
    if (p === 1) return [0b1111]; // Res V: E = ABCD
    const resIVAndIII = [
      0b0111, 0b1011, 0b1101, 0b1110, // k = 6..8: Res IV (all weight-3 masks)
      0b0011, 0b0101, 0b1001, 0b0110, 0b1010, 0b1100, 0b1111, // k = 9..15: Res III
    ];
    return resIVAndIII.slice(0, p);
  }

  if (runs === 32) {
    // b = 5, k = 6..16
    if (p === 1) return [0b11111]; // Res VI: F = ABCDE
    // All 11 odd-weight non-basic masks in 5 bits -> Res IV for all k = 7..16
    return oddWeightNonBasicMasks(5).slice(0, p);
  }

  if (runs === 64) {
    // b = 6, k = 7..16
    if (p === 1) return [0b111111]; // Res VII: G = ABCDEF
    if (p === 2) return [0b001111, 0b110011]; // Res V: G = ABCD, H = ABEF
    // Odd-weight non-basic masks in 6 bits -> Res IV for k = 9..16
    return oddWeightNonBasicMasks(6).slice(0, p);
  }

  if (runs === 128) {
    // b = 7, k = 8..16
    if (p === 1) return [0b1111111]; // Res VIII
    if (p === 2) return [0b0011111, 0b1100111]; // Res VI
    if (p === 3) return [0b0001111, 0b0110011, 0b1010101]; // Res V
    if (p === 4) return [0b0001111, 0b0110011, 0b1010101, 0b1111111]; // Res V
    // k = 12..16: Res IV
    return oddWeightNonBasicMasks(7).slice(0, p);
  }

  if (runs === 256) {
    // b = 8, k = 9..16
    if (p === 1) return [0b11111111]; // Res IX
    if (p === 2) return [0b00011111, 0b11100011]; // Res VI
    if (p === 3) return [0b10001111, 0b10110011, 0b11010101]; // Res VI (parity-lifted from b=7, k=10)
    if (p === 4) return [0b10001111, 0b10110011, 0b11010101, 0b01111111]; // Res VI (parity-lifted from b=7, k=11)
    // k = 13..16: Res V from RES_V_B8_GENERATORS
    return RES_V_B8_GENERATORS.slice(0, p);
  }

  if (runs === 512) {
    // b = 9, k = 10..16
    if (p === 1) return [0b111111111]; // Res X
    if (p === 2) return [0b000111111, 0b111000111]; // Res VII
    // k = 12..16 (p = 3..7): parity-lift RES_V_B8_GENERATORS by setting bit 8 on even-weight masks
    // so every generator has odd weight and every defining word has even weight >= 6 (Res VI)!
    return RES_V_B8_GENERATORS.slice(0, p).map(m => (popcount(m) % 2 === 0 ? (m | (1 << 8)) : m));
  }

  return null;
}

/**
 * Computes the exact numerical resolution (shortest word length in the defining relation)
 * of a regular 2^(k-p) fractional factorial from its p generator bitmasks over b = k - p basic factors.
 */
export function computeFractionResolution(runs: number, k: number, generators?: number[]): {
  resolutionNumber: number;
  resolutionRoman: string;
} {
  const b = Math.round(Math.log2(runs));
  const gens = generators ?? getRegularFractionGenerators(runs, k);
  if (!gens || gens.length !== k - b) {
    return { resolutionNumber: 0, resolutionRoman: '' };
  }
  const p = gens.length;
  const totalComb = 1 << p;
  let minWordLen = k + 1;

  for (let subset = 1; subset < totalComb; subset++) {
    let basicMask = 0;
    for (let j = 0; j < p; j++) {
      if ((subset & (1 << j)) !== 0) {
        basicMask ^= gens[j];
      }
    }
    const wordLen = popcount(basicMask) + popcount(subset);
    if (wordLen < minWordLen) {
      minWordLen = wordLen;
    }
  }

  return {
    resolutionNumber: minWordLen,
    resolutionRoman: ROMAN_RESOLUTION[minWordLen] || String(minWordLen),
  };
}

/**
 * Formats the generator equations (e.g. "D = A*B*C") using factor names or standard letters.
 */
export function formatFractionGenerators(factors: Factor[], runs: number, generators: number[]): string[] {
  const b = Math.round(Math.log2(runs));
  const labels = factors.map((f, i) => f.name || String.fromCharCode(65 + i));
  return generators.map((mask, j) => {
    const genFactorLabel = labels[b + j] || `F${b + j + 1}`;
    const basicTerms: string[] = [];
    for (let bit = 0; bit < b; bit++) {
      if ((mask & (1 << bit)) !== 0) {
        basicTerms.push(labels[bit] || `F${bit + 1}`);
      }
    }
    return `${genFactorLabel} = ${basicTerms.join('*')}`;
  });
}

export interface BuiltRegularFractionResult {
  runs: Run[];
  designName: string;
  notes: string;
  resolutionRoman: string;
  resolutionNumber: number;
  generators: string[];
}

/**
 * Builds a regular 2^(k-p) fractional factorial design from its minimum-aberration generators.
 * Returns null if the factor count or run count does not correspond to a regular 2-level fraction.
 */
export function buildRegularFraction(
  factors: Factor[],
  responses: Response[],
  targetRuns: number,
  centerPoints: number = 0
): BuiltRegularFractionResult | null {
  const k = factors.length;
  const allTwoLevel = factors.every(f => f.type !== 'categorical' || !f.levels || f.levels.length <= 2);
  if (!allTwoLevel) return null;

  const gens = getRegularFractionGenerators(targetRuns, k);
  if (!gens) return null;

  const b = Math.round(Math.log2(targetRuns));
  const p = k - b;
  const { resolutionNumber, resolutionRoman } = computeFractionResolution(targetRuns, k, gens);
  const generatorEquations = formatFractionGenerators(factors, targetRuns, gens);

  const createEmptyResponses = (): Record<string, null> => {
    const res: Record<string, null> = {};
    responses.forEach(r => {
      res[r.id] = null;
    });
    return res;
  };

  const runs: Run[] = [];
  for (let r = 0; r < targetRuns; r++) {
    const coded: number[] = new Array(k).fill(-1);
    for (let bit = 0; bit < b; bit++) {
      coded[bit] = ((r >> bit) & 1) === 1 ? 1 : -1;
    }
    for (let j = 0; j < p; j++) {
      const mask = gens[j];
      let prod = 1;
      for (let bit = 0; bit < b; bit++) {
        if ((mask & (1 << bit)) !== 0) {
          prod *= coded[bit];
        }
      }
      coded[b + j] = prod;
    }

    const runSettings: Record<string, string | number> = {};
    factors.forEach((f, idx) => {
      const isHi = coded[idx] > 0;
      if (f.type === 'categorical') {
        const lvls = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        runSettings[f.id] = isHi ? (lvls[1] ?? lvls[0]) : lvls[0];
      } else {
        runSettings[f.id] = isHi ? f.max : f.min;
      }
    });

    runs.push({
      id: uuidv4(),
      runOrder: r + 1,
      stdOrder: r + 1,
      factors: runSettings,
      responses: createEmptyResponses(),
    });
  }

  const cpResult = buildCenterPointRuns(factors, responses, centerPoints, runs.length + 1);
  runs.push(...cpResult.runs);

  const genSummary = generatorEquations.length <= 4
    ? generatorEquations.join(', ')
    : `${generatorEquations.slice(0, 3).join(', ')}, ... (${generatorEquations.length} generators)`;

  return {
    runs,
    designName: `Regular 2^(${k}-${p}) Fractional Factorial (Resolution ${resolutionRoman})`,
    notes: `Regular 2^(${k}-${p}) Resolution ${resolutionRoman} fractional factorial (${targetRuns} treatment runs${cpResult.runs.length > 0 ? ` + ${cpResult.runs.length} center point(s)` : ''}; Generators: ${genSummary})`,
    resolutionRoman,
    resolutionNumber,
    generators: generatorEquations,
  };
}

