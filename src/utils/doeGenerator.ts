import { v4 as uuidv4 } from 'uuid';
import { Factor, Response, Run, DesignType } from '../types';
import { generateDOptimalSubset } from './dOptimal';

export interface GenerateDesignOptions {
  centerPoints?: number;
  targetRuns?: number;
}

export interface GeneratedDesignResult {
  runs: Run[];
  designName: string;
  notes: string;
  dEfficiency?: number;
}

/**
 * Generates experimental runs for any supported DOE design type
 */
export function generateDesign(
  factors: Factor[],
  responses: Response[],
  designType: DesignType = 'factorial_2level',
  options: GenerateDesignOptions = {}
): GeneratedDesignResult {
  if (!factors || factors.length === 0) {
    return {
      runs: [],
      designName: 'Empty Design',
      notes: 'No factors defined.',
    };
  }

  const fCount = factors.length;
  const continuousFactors = factors.filter(f => f.type !== 'categorical');
  const categoricalFactors = factors.filter(f => f.type === 'categorical');
  const hasCategorical = categoricalFactors.length > 0;
  const allCategoricalAre2Level = categoricalFactors.every(f => !f.levels || f.levels.length <= 2);

  // Degrees of freedom needed for main effects
  const pMain = 1 + factors.reduce((acc, f) => {
    if (f.type === 'categorical') {
      const lvls = f.levels && f.levels.length > 0 ? f.levels.length : 2;
      return acc + (lvls - 1);
    }
    return acc + 1;
  }, 0);

  const getCartesianRuns = (candidateLevelsMap: (string | number)[][]): Record<string, string | number>[] => {
    let combs: (string | number)[][] = [[]];
    for (const levels of candidateLevelsMap) {
      const nextComb: (string | number)[][] = [];
      for (const comb of combs) {
        for (const lvl of levels) {
          nextComb.push([...comb, lvl]);
        }
      }
      combs = nextComb;
    }
    return combs.map(comb => {
      const runSettings: Record<string, string | number> = {};
      factors.forEach((f, idx) => {
        runSettings[f.id] = comb[idx];
      });
      return runSettings;
    });
  };

  const createRun = (order: number, settings: Record<string, string | number>): Run => {
    const runResponses: Record<string, null> = {};
    responses.forEach(r => {
      runResponses[r.id] = null;
    });
    return {
      id: uuidv4(),
      runOrder: order,
      stdOrder: order,
      factors: { ...settings },
      responses: runResponses,
    };
  };

  let newRuns: Run[] = [];
  let designName = '';
  let notes = '';
  let dEfficiency: number | undefined;

  const targetRuns = options.targetRuns;
  const centerPoints = Math.max(0, options.centerPoints !== undefined ? options.centerPoints : 3);

  if (designType === 'custom_d_optimal') {
    const candidateLevelsList: (string | number)[][] = factors.map(f => {
      if (f.type === 'categorical') {
        return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
      }
      return fCount <= 5 ? [f.min, (f.min + f.max) / 2, f.max] : [f.min, f.max];
    });
    const allCandidateRuns = getCartesianRuns(candidateLevelsList);
    const runsToGen = targetRuns && targetRuns > 0
      ? Math.min(allCandidateRuns.length, targetRuns)
      : Math.min(allCandidateRuns.length, Math.max(pMain + 3, 12));

    const result = generateDOptimalSubset(allCandidateRuns, factors, runsToGen);
    dEfficiency = result.dEfficiency;

    newRuns = result.selectedIndices.map((idx, i) => createRun(i + 1, allCandidateRuns[idx]));
    designName = 'D-Optimal Custom Design';
    notes = `Selected ${newRuns.length} statistically optimal treatment runs from ${allCandidateRuns.length} candidates (D-Efficiency: ${(dEfficiency * 100).toFixed(1)}%)`;

  } else if (designType === 'ccd') {
    // Central Composite Design
    if (hasCategorical) {
      if (continuousFactors.length === 0) {
        // Fallback to D-optimal for pure categorical
        const candidateLevelsList = factors.map(f => f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2']);
        const allCandidateRuns = getCartesianRuns(candidateLevelsList);
        const runsToGen = targetRuns && targetRuns > 0 ? Math.min(allCandidateRuns.length, targetRuns) : Math.min(allCandidateRuns.length, 12);
        const result = generateDOptimalSubset(allCandidateRuns, factors, runsToGen);
        dEfficiency = result.dEfficiency;
        newRuns = result.selectedIndices.map((idx, i) => createRun(i + 1, allCandidateRuns[idx]));
        designName = 'D-Optimal Design (Categorical)';
        notes = 'Generated D-Optimal design because CCD requires continuous factors.';
      } else {
        const ccdContinuousRuns: Record<string, number>[] = [];
        const cNum = continuousFactors.length;
        const numRuns = Math.pow(2, cNum);

        // Cube points
        for (let i = 0; i < numRuns; i++) {
          const runFactors: Record<string, number> = {};
          continuousFactors.forEach((f, idx) => {
            const isHi = (i & (1 << idx)) !== 0;
            runFactors[f.id] = isHi ? f.max : f.min;
          });
          ccdContinuousRuns.push(runFactors);
        }

        // Axial points (alpha = 1)
        continuousFactors.forEach(fAxis => {
          const runLow: Record<string, number> = {};
          const runHi: Record<string, number> = {};
          continuousFactors.forEach(f => {
            runLow[f.id] = (f.id === fAxis.id) ? f.min : ((f.min + f.max) / 2);
            runHi[f.id] = (f.id === fAxis.id) ? f.max : ((f.min + f.max) / 2);
          });
          ccdContinuousRuns.push(runLow);
          ccdContinuousRuns.push(runHi);
        });

        // Center points
        for (let cp = 0; cp < Math.max(1, centerPoints); cp++) {
          const runCp: Record<string, number> = {};
          continuousFactors.forEach(f => {
            runCp[f.id] = (f.min + f.max) / 2;
          });
          ccdContinuousRuns.push(runCp);
        }

        // Stratified combinations across categorical
        const catLevelsList = categoricalFactors.map(f => f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2']);
        let catCombs: (string | number)[][] = [[]];
        for (const levels of catLevelsList) {
          const nextComb: (string | number)[][] = [];
          for (const comb of catCombs) {
            for (const lvl of levels) {
              nextComb.push([...comb, lvl]);
            }
          }
          catCombs = nextComb;
        }

        let order = 1;
        for (const catComb of catCombs) {
          const catSettings: Record<string, string | number> = {};
          categoricalFactors.forEach((cf, cIdx) => {
            catSettings[cf.id] = catComb[cIdx];
          });
          for (const contRun of ccdContinuousRuns) {
            newRuns.push(createRun(order++, { ...contRun, ...catSettings }));
          }
        }

        designName = 'Stratified Central Composite Design (CCD)';
        notes = `${ccdContinuousRuns.length} continuous RSM points replicated across ${catCombs.length} categorical level combination(s)`;
      }
    } else {
      // Continuous CCD
      const numRuns = Math.pow(2, fCount);
      let order = 1;

      // Cube points
      for (let i = 0; i < numRuns; i++) {
        const runFactors: Record<string, number> = {};
        factors.forEach((f, idx) => {
          const isHi = (i & (1 << idx)) !== 0;
          runFactors[f.id] = isHi ? f.max : f.min;
        });
        newRuns.push(createRun(order++, runFactors));
      }

      // Axial star points
      factors.forEach(fAxis => {
        const runLow: Record<string, number> = {};
        const runHi: Record<string, number> = {};
        factors.forEach(f => {
          runLow[f.id] = (f.id === fAxis.id) ? f.min : ((f.min + f.max) / 2);
          runHi[f.id] = (f.id === fAxis.id) ? f.max : ((f.min + f.max) / 2);
        });
        newRuns.push(createRun(order++, runLow));
        newRuns.push(createRun(order++, runHi));
      });

      // Center points
      for (let cp = 0; cp < Math.max(1, centerPoints); cp++) {
        const runCp: Record<string, number> = {};
        factors.forEach(f => {
          runCp[f.id] = (f.min + f.max) / 2;
        });
        newRuns.push(createRun(order++, runCp));
      }

      designName = 'Central Composite Design (CCD)';
      notes = `Full response surface: ${numRuns} cube points, ${2 * fCount} axial points, and ${Math.max(1, centerPoints)} center points`;
    }

  } else if (designType === 'bbd') {
    // Box-Behnken Design
    if (continuousFactors.length < 3) {
      // Fallback to D-optimal RSM
      const candidateLevelsList: (string | number)[][] = factors.map(f => {
        if (f.type === 'categorical') return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        return [f.min, (f.min + f.max) / 2, f.max];
      });
      const allCandidateRuns = getCartesianRuns(candidateLevelsList);
      const runsToGen = targetRuns && targetRuns > 0 ? Math.min(allCandidateRuns.length, targetRuns) : Math.min(allCandidateRuns.length, 16);
      const result = generateDOptimalSubset(allCandidateRuns, factors, runsToGen);
      dEfficiency = result.dEfficiency;
      newRuns = result.selectedIndices.map((idx, i) => createRun(i + 1, allCandidateRuns[idx]));
      designName = 'D-Optimal RSM Design';
      notes = 'Generated D-optimal response surface design because Box-Behnken requires at least 3 continuous factors.';
    } else {
      const cCount = continuousFactors.length;
      const bbdContinuousRuns: Record<string, number>[] = [];

      for (let i = 0; i < cCount - 1; i++) {
        for (let j = i + 1; j < cCount; j++) {
          const combos = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
          combos.forEach(combo => {
            const runFactors: Record<string, number> = {};
            continuousFactors.forEach((f, idx) => {
              if (idx === i) runFactors[f.id] = combo[0] === 1 ? f.max : f.min;
              else if (idx === j) runFactors[f.id] = combo[1] === 1 ? f.max : f.min;
              else runFactors[f.id] = (f.min + f.max) / 2;
            });
            bbdContinuousRuns.push(runFactors);
          });
        }
      }

      for (let cp = 0; cp < Math.max(1, centerPoints); cp++) {
        const cpContinuous: Record<string, number> = {};
        continuousFactors.forEach(f => cpContinuous[f.id] = (f.min + f.max) / 2);
        bbdContinuousRuns.push(cpContinuous);
      }

      if (hasCategorical) {
        const catLevelsList = categoricalFactors.map(f => f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2']);
        let catCombs: (string | number)[][] = [[]];
        for (const levels of catLevelsList) {
          const nextComb: (string | number)[][] = [];
          for (const comb of catCombs) {
            for (const lvl of levels) {
              nextComb.push([...comb, lvl]);
            }
          }
          catCombs = nextComb;
        }

        let order = 1;
        for (const catComb of catCombs) {
          const catSettings: Record<string, string | number> = {};
          categoricalFactors.forEach((cf, cIdx) => {
            catSettings[cf.id] = catComb[cIdx];
          });
          for (const contRun of bbdContinuousRuns) {
            newRuns.push(createRun(order++, { ...contRun, ...catSettings }));
          }
        }
        designName = 'Stratified Box-Behnken Design (BBD)';
        notes = `${bbdContinuousRuns.length} continuous BBD points replicated across ${catCombs.length} categorical level combination(s)`;
      } else {
        newRuns = bbdContinuousRuns.map((r, i) => createRun(i + 1, r));
        designName = 'Box-Behnken Design (BBD)';
        notes = `Spherical 3-level response surface design avoiding extreme corners (${newRuns.length} runs)`;
      }
    }

  } else if (designType === 'plackett_burman') {
    // Plackett-Burman Design
    if (allCategoricalAre2Level) {
      let seedRow: number[] = [];
      if (fCount <= 11) seedRow = [1, 1, -1, 1, 1, 1, -1, -1, -1, 1, -1];
      else seedRow = [1, 1, -1, -1, 1, 1, 1, 1, -1, 1, -1, 1, -1, -1, -1, -1, 1, 1, -1];

      const N = seedRow.length + 1;
      let order = 1;

      for (let i = 0; i < N - 1; i++) {
        const runFactors: Record<string, string | number> = {};
        factors.forEach((f, idx) => {
          const isHi = idx < seedRow.length ? (seedRow[(idx - i + seedRow.length) % seedRow.length] === 1) : false;
          if (f.type === 'categorical') {
            const lvls = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
            runFactors[f.id] = isHi ? (lvls[1] || lvls[0]) : lvls[0];
          } else {
            runFactors[f.id] = isHi ? f.max : f.min;
          }
        });
        newRuns.push(createRun(order++, runFactors));
      }

      const lastRowFactors: Record<string, string | number> = {};
      factors.forEach(f => {
        if (f.type === 'categorical') {
          const lvls = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
          lastRowFactors[f.id] = lvls[0];
        } else {
          lastRowFactors[f.id] = f.min;
        }
      });
      newRuns.push(createRun(order++, lastRowFactors));

      // Optional center points
      for (let cp = 0; cp < centerPoints; cp++) {
        const cpFactors: Record<string, string | number> = {};
        factors.forEach(f => {
          if (f.type === 'categorical') {
            const lvls = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
            cpFactors[f.id] = lvls[0];
          } else {
            cpFactors[f.id] = (f.min + f.max) / 2;
          }
        });
        newRuns.push(createRun(order++, cpFactors));
      }

      designName = 'Plackett-Burman Design (PB)';
      notes = `Orthogonal 2-level screening matrix (${newRuns.length} runs)`;
    } else {
      // Multi-level categorical fallback to D-Optimal screening
      const candidateLevelsList = factors.map(f => {
        if (f.type === 'categorical') return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        return [f.min, f.max];
      });
      const allCandidateRuns = getCartesianRuns(candidateLevelsList);
      const runsToGen = targetRuns && targetRuns > 0 ? targetRuns : 12;
      const result = generateDOptimalSubset(allCandidateRuns, factors, runsToGen);
      dEfficiency = result.dEfficiency;
      newRuns = result.selectedIndices.map((idx, i) => createRun(i + 1, allCandidateRuns[idx]));
      designName = '12-Run Screening Design (D-Optimal PB Equivalent)';
      notes = 'Orthogonal screening array adapted for 3+ level categorical factors';
    }

  } else if (designType === 'dsd') {
    // Definitive Screening Design
    if (hasCategorical) {
      const candidateLevelsList = factors.map(f => {
        if (f.type === 'categorical') return f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        return [f.min, (f.min + f.max) / 2, f.max];
      });
      const allCandidateRuns = getCartesianRuns(candidateLevelsList);
      const targetDSDRuns = 2 * continuousFactors.length + 1 + 2 * categoricalFactors.length;
      const runsToGen = Math.max(targetDSDRuns, pMain + 2);
      const result = generateDOptimalSubset(allCandidateRuns, factors, runsToGen);
      dEfficiency = result.dEfficiency;
      newRuns = result.selectedIndices.map((idx, i) => createRun(i + 1, allCandidateRuns[idx]));
      designName = 'Definitive Screening Design (DSD)';
      notes = '3-level screening for continuous factors with balanced categorical assignments';
    } else {
      const m = fCount;
      let order = 1;
      for (let i = 0; i < m; i++) {
        const run1: Record<string, number> = {};
        const run2: Record<string, number> = {};
        factors.forEach((f, fIdx) => {
          if (fIdx === i) {
            run1[f.id] = (f.min + f.max) / 2;
            run2[f.id] = (f.min + f.max) / 2;
          } else {
            const isHi = ((i + fIdx) % 2) === 0;
            run1[f.id] = isHi ? f.max : f.min;
            run2[f.id] = isHi ? f.min : f.max;
          }
        });
        newRuns.push(createRun(order++, run1));
        newRuns.push(createRun(order++, run2));
      }

      for (let cp = 0; cp < Math.max(1, centerPoints); cp++) {
        const cpFactors: Record<string, number> = {};
        factors.forEach(f => cpFactors[f.id] = (f.min + f.max) / 2);
        newRuns.push(createRun(order++, cpFactors));
      }

      designName = 'Definitive Screening Design (DSD)';
      notes = `${newRuns.length} runs with foldover pairs and center point(s)`;
    }

  } else {
    // Two-Level Factorial / Fractional Factorial
    const factorLevelsList: (string | number)[][] = factors.map(f => {
      if (f.type === 'categorical' && f.levels && f.levels.length > 0) {
        return f.levels;
      }
      return [f.min, f.max];
    });
    const allCandidateRuns = getCartesianRuns(factorLevelsList);
    const numRuns = allCandidateRuns.length;
    const runsToGen = targetRuns && targetRuns > 0 ? targetRuns : numRuns;

    if (runsToGen > 0 && runsToGen < numRuns) {
      const result = generateDOptimalSubset(allCandidateRuns, factors, runsToGen);
      dEfficiency = result.dEfficiency;
      newRuns = result.selectedIndices.map((idx, i) => createRun(i + 1, allCandidateRuns[idx]));
      designName = 'Fractional Factorial Design';
      notes = `Resolution-optimized fractional subset of ${runsToGen} runs from ${numRuns} full factorial treatments`;
    } else {
      newRuns = allCandidateRuns.map((settings, i) => createRun(i + 1, settings));

      // Add center points if continuous factors exist
      if (continuousFactors.length > 0 && centerPoints > 0) {
        const nextOrder = newRuns.length + 1;
        for (let cp = 0; cp < centerPoints; cp++) {
          const cpFactors: Record<string, string | number> = {};
          factors.forEach(f => {
            if (f.type === 'categorical') {
              cpFactors[f.id] = f.levels && f.levels.length > 0 ? f.levels[0] : 'Level 1';
            } else {
              cpFactors[f.id] = (f.min + f.max) / 2;
            }
          });
          newRuns.push(createRun(nextOrder + cp, cpFactors));
        }
      }

      designName = 'Full Factorial Design';
      notes = `Complete orthogonal factorial matrix with ${newRuns.length} runs`;
    }
  }

  return {
    runs: newRuns,
    designName,
    notes,
    dEfficiency,
  };
}
