import { v4 as uuidv4 } from 'uuid';
import { DesignType, Factor, Response, Run } from '../types';
import { generateDOptimalSubset, computeDEfficiency, buildCodedModelRow } from './dOptimal';
import {
  computeFractionResolution,
  buildRegularFraction,
  getRegularFractionGenerators,
  formatFractionGenerators,
} from './fractions';
import { buildDSD, generateDefinitiveScreeningDesign, buildConferenceMatrix } from './dsd';
import { buildCenterPointRuns, buildAxialPointRuns, getSafeCategoricalLevels } from './centerPoints';
import { randomize, generateRandomSeed, createSeededRng } from './randomize';

export {
  computeFractionResolution,
  buildRegularFraction,
  getRegularFractionGenerators,
  formatFractionGenerators,
  buildDSD,
  generateDefinitiveScreeningDesign,
  buildConferenceMatrix,
  buildCenterPointRuns,
  buildAxialPointRuns,
  getSafeCategoricalLevels,
  randomize,
  generateRandomSeed,
  createSeededRng,
  computeDEfficiency,
};

export interface DoeGeneratorOptions {
  designType?: DesignType;
  resolution?: 'Full' | 'III' | 'IV' | 'V' | 'Custom' | string;
  fractionP?: number;
  centerPoints?: number;
  replicates?: number;
  targetRuns?: number;
  numRuns?: number;
  ccdType?: 'faced' | 'circumscribed' | 'inscribed';
  /** Whether to randomise runOrder after assigning stdOrder = 1..N (default: true). */
  randomize?: boolean;
  /** Optional integer seed for reproducible Fisher-Yates randomisation (P1.19 / DES-7). */
  randomSeed?: number;
}

export interface GeneratedDesignResult {
  runs: Run[];
  designType: string;
  designName: string;
  totalRuns: number;
  dEfficiency?: number | null;
  resolution?: string;
  generators?: string[];
  isRegularFraction?: boolean;
  isTrueDsd?: boolean;
  randomSeed?: number;
  warnings?: string[];
  notes: string;
}

/**
 * Generates an n x (n-1) Plackett-Burman matrix using standard cyclic Hadamard first rows
 * for n = 8, 12, 16, 20, 24.
 */
function getPlackettBurmanMatrix(k: number): number[][] {
  let n = 8;
  if (k >= 8 && k <= 11) n = 12;
  else if (k >= 12 && k <= 15) n = 16;
  else if (k >= 16 && k <= 19) n = 20;
  else if (k >= 20) n = 24;

  const firstRows: Record<number, number[]> = {
    8: [1, 1, 1, -1, 1, -1, -1],
    12: [1, 1, -1, 1, 1, 1, -1, -1, -1, 1, -1],
    16: [1, 1, 1, 1, -1, 1, -1, 1, 1, -1, -1, 1, -1, -1, -1],
    20: [1, 1, -1, -1, 1, 1, 1, 1, -1, 1, -1, 1, -1, -1, -1, -1, 1, 1, -1],
    24: [1, 1, 1, 1, 1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 1, -1, -1, -1, -1],
  };

  const generator = firstRows[n] || firstRows[12];
  const cols = n - 1;
  const matrix: number[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const row: number[] = [];
    for (let c = 0; c < Math.min(k, cols); c++) {
      row.push(generator[(c - r + cols) % cols]);
    }
    matrix.push(row);
  }
  matrix.push(new Array(Math.min(k, cols)).fill(-1));
  return matrix;
}

/**
 * Core DOE Matrix Generator shared between UI and MCP Server.
 * Supports both `generateDesign(factors, responses, designType, options)` and
 * `generateDoeDesign(factors, responses, options)`.
 */
export function generateDesign(
  factors: Factor[],
  responses: Response[],
  designTypeArg?: DesignType | DoeGeneratorOptions,
  optionsArg: DoeGeneratorOptions = {}
): GeneratedDesignResult {
  const options: DoeGeneratorOptions =
    typeof designTypeArg === 'object' && designTypeArg !== null
      ? designTypeArg
      : { ...optionsArg, designType: (designTypeArg as DesignType) || optionsArg.designType };

  const designType: DesignType = options.designType || 'factorial_2level';
  const replicates = Math.max(1, options.replicates ?? 1);
  const ccdType = options.ccdType || 'faced';

  // Honour explicit centerPoints = 0 for every design type (P1.20 / DES-6)
  const defaultCenterPoints =
    designType === 'dsd' ? 1 : designType === 'ccd' || designType === 'bbd' ? 3 : 0;
  const centerPoints =
    options.centerPoints !== undefined && Number.isFinite(options.centerPoints)
      ? Math.max(0, Math.floor(options.centerPoints))
      : defaultCenterPoints;

  let newRuns: Run[] = [];
  let order = 1;
  let designName = 'Full Factorial Design';
  let dEfficiency: number | null | undefined = undefined;
  let resolutionOut: string | undefined = undefined;
  let generatorsOut: string[] | undefined = undefined;
  let isRegularFractionOut: boolean | undefined = undefined;
  let isTrueDsdOut: boolean | undefined = undefined;
  const warnings: string[] = [];
  let notes = '';

  const continuousFactors = factors.filter(f => f.type === 'numeric');
  const categoricalFactors = factors.filter(f => f.type === 'categorical');
  const k = continuousFactors.length;

  let catCombinations: Record<string, string>[] = [{}];
  categoricalFactors.forEach(cf => {
    const levels = getSafeCategoricalLevels(cf);
    const next: Record<string, string>[] = [];
    catCombinations.forEach(comb => {
      levels.forEach(lvl => {
        next.push({ ...comb, [cf.id]: lvl });
      });
    });
    catCombinations = next;
  });

  if (designType === 'plackett_burman') {
    const pbMatrix = getPlackettBurmanMatrix(factors.length);
    for (let rep = 0; rep < replicates; rep++) {
      pbMatrix.forEach(row => {
        const runFactors: Record<string, string | number> = {};
        factors.forEach((f, idx) => {
          const code = row[idx] ?? -1;
          if (f.type === 'categorical') {
            const levels = getSafeCategoricalLevels(f);
            runFactors[f.id] = code === 1 ? levels[Math.min(1, levels.length - 1)] : levels[0];
          } else {
            runFactors[f.id] = code === 1 ? f.max : f.min;
          }
        });
        newRuns.push({
          id: uuidv4(),
          runOrder: order,
          stdOrder: order++,
          factors: runFactors,
          responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
        });
      });
    }
    if (centerPoints > 0) {
      const cpResult = buildCenterPointRuns(factors, responses, centerPoints, order);
      if (cpResult.warning) warnings.push(cpResult.warning);
      newRuns.push(...cpResult.runs);
      order += cpResult.runs.length;
    }
    const codedRows = newRuns.map(r => buildCodedModelRow(factors, r.factors, false, false));
    dEfficiency = computeDEfficiency(codedRows);
    designName = 'Plackett-Burman Design (PB)';
    notes = `Plackett-Burman Screening Design (${pbMatrix.length} base runs${centerPoints > 0 ? ` + ${centerPoints} center pts` : ''}, Resolution III)`;
  } else if (designType === 'ccd') {
    let alpha = 1.0;
    if (ccdType === 'circumscribed') alpha = Math.pow(Math.pow(2, k), 0.25);
    else if (ccdType === 'inscribed') alpha = 1 / Math.pow(Math.pow(2, k), 0.25);

    const numCube = Math.pow(2, k);
    for (let rep = 0; rep < replicates; rep++) {
      catCombinations.forEach(catComb => {
        for (let i = 0; i < numCube; i++) {
          const runFactors: Record<string, string | number> = { ...catComb };
          continuousFactors.forEach((f, idx) => {
            const isHigh = (i & (1 << idx)) !== 0;
            if (ccdType === 'inscribed') {
              const mid = (f.min + f.max) / 2;
              const half = (f.max - f.min) / 2;
              runFactors[f.id] = Number((mid + (isHigh ? 1 : -1) * alpha * half).toFixed(4));
            } else {
              runFactors[f.id] = isHigh ? f.max : f.min;
            }
          });
          newRuns.push({
            id: uuidv4(),
            runOrder: order,
            stdOrder: order++,
            factors: runFactors,
            responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
          });
        }
        continuousFactors.forEach(f => {
          [-1, 1].forEach(dir => {
            const runFactors: Record<string, string | number> = { ...catComb };
            continuousFactors.forEach(otherF => {
              const mid = (otherF.min + otherF.max) / 2;
              const half = (otherF.max - otherF.min) / 2;
              if (otherF.id === f.id) {
                if (ccdType === 'inscribed') {
                  runFactors[otherF.id] = dir === 1 ? otherF.max : otherF.min;
                } else {
                  runFactors[otherF.id] = Number((mid + dir * alpha * half).toFixed(4));
                }
              } else {
                runFactors[otherF.id] = Number(mid.toFixed(4));
              }
            });
            newRuns.push({
              id: uuidv4(),
              runOrder: order,
              stdOrder: order++,
              factors: runFactors,
              responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
            });
          });
        });
      });
    }
    if (centerPoints > 0) {
      const cpResult = buildCenterPointRuns(factors, responses, centerPoints, order);
      if (cpResult.warning) warnings.push(cpResult.warning);
      newRuns.push(...cpResult.runs);
      order += cpResult.runs.length;
    }
    const codedRows = newRuns.map(r => buildCodedModelRow(factors, r.factors, true, true));
    dEfficiency = computeDEfficiency(codedRows);
    designName = 'Central Composite Design (CCD)';
    notes = `Central Composite Design (${ccdType}, alpha=${alpha.toFixed(2)}, ${centerPoints} center pts)`;
  } else if (designType === 'bbd') {
    for (let rep = 0; rep < replicates; rep++) {
      catCombinations.forEach(catComb => {
        for (let i = 0; i < k; i++) {
          for (let j = i + 1; j < k; j++) {
            [-1, 1].forEach(dir1 => {
              [-1, 1].forEach(dir2 => {
                const runFactors: Record<string, string | number> = { ...catComb };
                continuousFactors.forEach((f, idx) => {
                  if (idx === i) runFactors[f.id] = dir1 === 1 ? f.max : f.min;
                  else if (idx === j) runFactors[f.id] = dir2 === 1 ? f.max : f.min;
                  else runFactors[f.id] = Number(((f.min + f.max) / 2).toFixed(4));
                });
                newRuns.push({
                  id: uuidv4(),
                  runOrder: order,
                  stdOrder: order++,
                  factors: runFactors,
                  responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
                });
              });
            });
          }
        }
      });
    }
    if (centerPoints > 0) {
      const cpResult = buildCenterPointRuns(factors, responses, centerPoints, order);
      if (cpResult.warning) warnings.push(cpResult.warning);
      newRuns.push(...cpResult.runs);
      order += cpResult.runs.length;
    }
    const codedRows = newRuns.map(r => buildCodedModelRow(factors, r.factors, true, true));
    dEfficiency = computeDEfficiency(codedRows);
    designName = 'Box-Behnken Design (BBD)';
    notes = `Box-Behnken Response Surface Design (${centerPoints} center pts)`;
  } else if (designType === 'dsd') {
    const dsdResult = buildDSD(factors, responses, centerPoints);
    newRuns = dsdResult.runs;
    designName = dsdResult.designName;
    dEfficiency = dsdResult.dEfficiency;
    isTrueDsdOut = dsdResult.isTrueDsd;
    if (dsdResult.warning) warnings.push(dsdResult.warning);
    notes = dsdResult.notes;
  } else if (designType === 'custom_d_optimal') {
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

    const explicitTarget = options.targetRuns ?? options.numRuns;
    const targetRuns =
      explicitTarget !== undefined && Number.isFinite(explicitTarget)
        ? Math.floor(explicitTarget)
        : Math.min(candidates.length, Math.max(factors.length + 3, 12));
    const dOpt = generateDOptimalSubset(factors, candidates, targetRuns);
    if (dOpt.warning) warnings.push(dOpt.warning);
    dOpt.selectedRuns.forEach(pt => {
      newRuns.push({
        id: uuidv4(),
        runOrder: order,
        stdOrder: order++,
        factors: pt,
        responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
      });
    });
    if (centerPoints > 0) {
      const cpResult = buildCenterPointRuns(factors, responses, centerPoints, order);
      if (cpResult.warning) warnings.push(cpResult.warning);
      newRuns.push(...cpResult.runs);
      order += cpResult.runs.length;
    }
    dEfficiency = dOpt.dEfficiency;
    designName = 'D-Optimal Custom Design';
    const effStr = dOpt.dEfficiency !== null ? `${dOpt.dEfficiency.toFixed(1)}%` : 'not estimable';
    notes = `D-Optimal Custom Design (${dOpt.selectedRuns.length} model runs${centerPoints > 0 ? ` + ${centerPoints} center pts` : ''}, D-eff: ${effStr})`;
  } else {
    // 2-Level Full or Fractional Factorial (or Mixed-Level Factorial / D-Optimal Subset)
    const allTwoLevel = factors.every(
      f => f.type !== 'categorical' || getSafeCategoricalLevels(f).length <= 2
    );
    const fullTwoLevelRuns = Math.pow(2, factors.length);
    const explicitTarget = options.targetRuns ?? options.numRuns;

    let targetCornerRuns = fullTwoLevelRuns;
    if (explicitTarget !== undefined && Number.isFinite(explicitTarget) && explicitTarget > 0) {
      targetCornerRuns = Math.floor(explicitTarget);
    } else if (options.fractionP !== undefined && options.fractionP > 0) {
      targetCornerRuns = Math.max(4, Math.round(fullTwoLevelRuns / Math.pow(2, options.fractionP)));
    }

    if (allTwoLevel && targetCornerRuns < fullTwoLevelRuns) {
      const reg = buildRegularFraction(factors, responses, targetCornerRuns, centerPoints);
      if (reg) {
        newRuns = reg.runs;
        designName = reg.designName;
        resolutionOut = reg.resolutionRoman;
        generatorsOut = reg.generators;
        isRegularFractionOut = true;
        dEfficiency = 100;
        notes = reg.notes;
      }
    }

    if (newRuns.length === 0) {
      // Either Full Factorial or non-regular / mixed-level D-Optimal Subset
      let candidates: Record<string, string | number>[] = [{}];
      factors.forEach(f => {
        const next: Record<string, string | number>[] = [];
        if (f.type === 'categorical') {
          const levels = getSafeCategoricalLevels(f);
          candidates.forEach(c => levels.forEach(l => next.push({ ...c, [f.id]: l })));
        } else {
          candidates.forEach(c => [f.min, f.max].forEach(v => next.push({ ...c, [f.id]: v })));
        }
        candidates = next;
      });

      const effectiveTarget =
        explicitTarget !== undefined && Number.isFinite(explicitTarget) && explicitTarget > 0
          ? Math.floor(explicitTarget)
          : candidates.length;

      if (effectiveTarget < candidates.length) {
        const dOpt = generateDOptimalSubset(factors, candidates, effectiveTarget);
        if (dOpt.warning) warnings.push(dOpt.warning);
        for (let rep = 0; rep < replicates; rep++) {
          dOpt.selectedRuns.forEach(pt => {
            newRuns.push({
              id: uuidv4(),
              runOrder: order,
              stdOrder: order++,
              factors: pt,
              responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
            });
          });
        }
        if (centerPoints > 0) {
          const cpResult = buildCenterPointRuns(factors, responses, centerPoints, order);
          if (cpResult.warning) warnings.push(cpResult.warning);
          newRuns.push(...cpResult.runs);
          order += cpResult.runs.length;
        }
        dEfficiency = dOpt.dEfficiency;
        designName = 'D-Optimal Subset Design';
        resolutionOut = 'D-Optimal Subset';
        isRegularFractionOut = false;
        const effStr = dOpt.dEfficiency !== null ? `${dOpt.dEfficiency.toFixed(1)}%` : 'not estimable';
        notes = `D-Optimal subset of ${effectiveTarget} runs from ${candidates.length} candidate treatments${centerPoints > 0 ? ` + ${centerPoints} center pts` : ''} (D-eff: ${effStr})`;
      } else {
        for (let rep = 0; rep < replicates; rep++) {
          candidates.forEach(pt => {
            newRuns.push({
              id: uuidv4(),
              runOrder: order,
              stdOrder: order++,
              factors: pt,
              responses: responses.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}),
            });
          });
        }
        if (centerPoints > 0) {
          const cpResult = buildCenterPointRuns(factors, responses, centerPoints, order);
          if (cpResult.warning) warnings.push(cpResult.warning);
          newRuns.push(...cpResult.runs);
          order += cpResult.runs.length;
        }
        const codedRows = newRuns.map(r => buildCodedModelRow(factors, r.factors, false, false));
        dEfficiency = computeDEfficiency(codedRows);
        designName = allTwoLevel ? 'Full Factorial Design' : 'General Mixed-Level Factorial Design';
        resolutionOut = 'Full';
        isRegularFractionOut = false;
        notes = `${designName} (${candidates.length * replicates} corner runs${centerPoints > 0 ? ` + ${centerPoints} center pts` : ''})`;
      }
    }
  }

  // Assign unique sequential stdOrder = 1..N before optional randomisation (P1.19 / DES-7)
  const stdOrderedRuns: Run[] = newRuns.map((r, idx) => ({
    ...r,
    stdOrder: idx + 1,
    runOrder: idx + 1,
  }));

  const shouldRandomize = options.randomize !== false;
  let finalRuns = stdOrderedRuns;
  let usedSeed: number | undefined = options.randomSeed;

  if (shouldRandomize && stdOrderedRuns.length > 1) {
    usedSeed =
      options.randomSeed !== undefined && Number.isFinite(options.randomSeed)
        ? Math.floor(options.randomSeed)
        : generateRandomSeed();
    finalRuns = randomize(stdOrderedRuns, usedSeed);
  }

  return {
    runs: finalRuns,
    designType,
    designName,
    totalRuns: finalRuns.length,
    dEfficiency,
    resolution: resolutionOut,
    generators: generatorsOut,
    isRegularFraction: isRegularFractionOut,
    isTrueDsd: isTrueDsdOut,
    randomSeed: usedSeed,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes,
  };
}

export const generateDoeDesign = generateDesign;
