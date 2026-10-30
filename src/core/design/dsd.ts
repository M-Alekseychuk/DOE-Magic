import { v4 as uuidv4 } from 'uuid';
import { Factor, Response, Run } from '../types';
import { generateDOptimalSubset, computeDEfficiency, buildCodedModelRow } from './dOptimal';
import { buildCenterPointRuns, getSafeCategoricalLevels } from './centerPoints';

/**
 * Generates an m x m Paley conference matrix C for prime powers m = 2*ceil(k/2) ≡ 2 (mod 4)
 * with diagonal 0, off-diagonal ±1, and C'C = (m - 1) I_m (Jones & Nachtsheim 2011).
 */
export function buildConferenceMatrix(m: number): number[][] {
  if (m < 2 || m % 2 !== 0) {
    throw new Error(`Conference matrix order m must be an even integer >= 2 (got ${m}).`);
  }

  if (m === 2) {
    return [
      [0, 1],
      [1, 0],
    ];
  }

  const q = m - 1;
  if (q === 9) {
    const elements: [number, number][] = [];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        elements.push([a, b]);
      }
    }
    const chi = (a: number, b: number): number => {
      const da = (a + 3) % 3;
      const db = (b + 3) % 3;
      if (da === 0 && db === 0) return 0;
      if (da === 0 || db === 0) return 1;
      return -1;
    };

    const C: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
    for (let j = 1; j < 10; j++) {
      C[0][j] = 1;
      C[j][0] = 1;
    }
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
        const [ai, bi] = elements[i - 1];
        const [aj, bj] = elements[j - 1];
        C[i][j] = chi(ai - aj, bi - bj);
      }
    }
    return C;
  }

  const isResidue = new Set<number>();
  for (let x = 1; x < q; x++) {
    isResidue.add((x * x) % q);
  }
  const legendre = (d: number): number => {
    const rem = ((d % q) + q) % q;
    if (rem === 0) return 0;
    return isResidue.has(rem) ? 1 : -1;
  };

  const isSymmetric = q % 4 === 1;
  const C: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let j = 1; j < m; j++) {
    C[0][j] = 1;
    C[j][0] = isSymmetric ? 1 : -1;
  }
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < m; j++) {
      C[i][j] = legendre(i - j);
    }
  }
  return C;
}

export interface DsdGenerationResult {
  runs: Run[];
  designName: string;
  notes: string;
  note: string;
  dEfficiency: number | null;
  isTrueDsd: boolean;
  conferenceOrder?: number;
  warning?: string;
}

/**
 * Generates a true Jones-Nachtsheim (2011) Conference-Matrix Definitive Screening Design (DSD)
 * for k continuous factors (and optional 2-level categorical factors), or falls back to a
 * clearly-labelled 3-level D-optimal screening design when multi-level categorical factors are present.
 *
 * Honours `centerPoints = 0` when explicitly requested (P1.20 / DES-6) and warns when no
 * continuous factors exist (`DES-19`).
 */
export function buildDSD(
  factors: Factor[],
  responses: Response[],
  centerPoints: number = 1
): DsdGenerationResult {
  const continuousFactors = factors.filter(f => f.type === 'numeric');
  const categoricalFactors = factors.filter(f => f.type === 'categorical');
  const hasMultiLevelCat = categoricalFactors.some(f => getSafeCategoricalLevels(f).length > 2);
  const nCenter = Math.max(0, Math.floor(Number.isFinite(centerPoints) ? centerPoints : 1));

  // If there are multi-level categorical factors (>2 levels) or >14 total factors or no continuous factors,
  // fall back to a 3-level D-optimal screening design and label it explicitly (never call it a conference-matrix DSD).
  if (hasMultiLevelCat || factors.length > 14 || continuousFactors.length === 0) {
    let candidates: Record<string, string | number>[] = [{}];
    factors.forEach(f => {
      const next: Record<string, string | number>[] = [];
      if (f.type === 'categorical') {
        const levels = getSafeCategoricalLevels(f);
        candidates.forEach(c => levels.forEach(l => next.push({ ...c, [f.id]: l })));
      } else {
        const mid = Number(((f.min + f.max) / 2).toFixed(4));
        candidates.forEach(c => [f.min, mid, f.max].forEach(v => next.push({ ...c, [f.id]: v })));
      }
      candidates = next;
    });
    const baseTargetRuns = 2 * factors.length + 1;
    const dOpt = generateDOptimalSubset(factors, candidates, baseTargetRuns, false);
    const runs: Run[] = dOpt.selectedRuns.map((pt, idx) => ({
      id: uuidv4(),
      runOrder: idx + 1,
      stdOrder: idx + 1,
      factors: pt,
      responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
      status: 'pending',
    }));

    const cpResult = buildCenterPointRuns(factors, responses, nCenter, runs.length + 1);
    runs.push(...cpResult.runs);

    const effNote = dOpt.dEfficiency !== null ? `${dOpt.dEfficiency.toFixed(1)}%` : 'not estimable';
    const warnSuffix = cpResult.warning ? ` ${cpResult.warning}` : '';
    const notesText = `3-Level D-Optimal Screening Design (${runs.length} runs, D-eff: ${effNote}) — multi-level categorical or non-continuous factors present.${warnSuffix}`;
    return {
      runs,
      designName: '3-Level D-Optimal Screening Design',
      notes: notesText,
      note: notesText,
      dEfficiency: dOpt.dEfficiency,
      isTrueDsd: false,
      warning: cpResult.warning || dOpt.warning,
    };
  }

  // True Conference-Matrix DSD (Jones & Nachtsheim 2011 / 2013 for 2-level categoricals)
  const kTotal = continuousFactors.length + categoricalFactors.length;
  const kMin = Math.max(3, kTotal);
  const m = 2 * Math.ceil(kMin / 2);
  const C = buildConferenceMatrix(m);

  const orderedFactors = [...continuousFactors, ...categoricalFactors];
  const runs: Run[] = [];
  let order = 1;

  for (const sign of [1, -1] as const) {
    for (let r = 0; r < m; r++) {
      const runFactors: Record<string, string | number> = {};
      orderedFactors.forEach((f, colIdx) => {
        const coded = sign * C[r][colIdx];
        if (f.type === 'categorical') {
          const levels = getSafeCategoricalLevels(f);
          if (coded > 0) {
            runFactors[f.id] = levels[Math.min(1, levels.length - 1)];
          } else if (coded < 0) {
            runFactors[f.id] = levels[0];
          } else {
            runFactors[f.id] = sign === 1 ? levels[Math.min(1, levels.length - 1)] : levels[0];
          }
        } else {
          const mid = (f.min + f.max) / 2;
          const half = (f.max - f.min) / 2;
          runFactors[f.id] = Number((mid + coded * half).toFixed(4));
        }
      });
      runs.push({
        id: uuidv4(),
        runOrder: order,
        stdOrder: order++,
        factors: runFactors,
        responses: responses.reduce((acc, resp) => ({ ...acc, [resp.id]: null }), {}),
      });
    }
  }

  const cpResult = buildCenterPointRuns(factors, responses, nCenter, order);
  runs.push(...cpResult.runs);

  const codedRows = runs.map(r => buildCodedModelRow(factors, r.factors, false, false));
  const dEff = computeDEfficiency(codedRows);
  const notesText = `Definitive Screening Design (Jones-Nachtsheim Conference Matrix C_${m}, ${runs.length} runs, orthogonal main effects)`;

  return {
    runs,
    designName: 'Definitive Screening Design (DSD)',
    notes: notesText,
    note: notesText,
    dEfficiency: dEff,
    isTrueDsd: true,
    conferenceOrder: m,
    warning: cpResult.warning,
  };
}

export const generateDefinitiveScreeningDesign = buildDSD;
