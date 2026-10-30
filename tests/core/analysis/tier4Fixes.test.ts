import { describe, expect, it } from 'vitest';
import { computeAnalysis, predictModelResponse, validateRuns } from '../../../src/core/analysis/analysisCore';
import { getFactorContrasts } from '../../../src/core/analysis/modelSpec';
import { computeDEfficiency, generateDOptimalSubset } from '../../../src/core/design/dOptimal';
import { buildCenterPointRuns, buildAxialPointRuns } from '../../../src/core/design/centerPoints';
import { generateDesign } from '../../../src/core/design/doeGenerator';
import { buildOptimizationOptions } from '../../../src/core/optimization/optimize';
import { generateExportHTML } from '../../../src/web/features/export/htmlExport';
import { connectMcp } from '../../helpers/mcp';
import { Factor, Project, Response, Run } from '../../../src/core/types';

describe('Tier 4 fixes: P1.11, P1.18, P1.19, P1.20, P1.21, P1.4, P1.14', () => {
  describe('P1.11 (STAT-11, STAT-14, STAT-26): Validate runs before fitting & no [-2, 2] clamp', () => {
    const factors: Factor[] = [
      { id: 'f1', name: 'Temperature', unit: 'C', type: 'numeric', min: 50, max: 100 },
      { id: 'f2', name: 'Solvent', unit: '', type: 'categorical', min: 0, max: 1, levels: ['EtOH', 'MeOH'] }
    ];
    const response: Response = { id: 'r1', name: 'Yield', unit: '%', goal: 'maximize' };

    it('STAT-11 / STAT-26: excludes and reports runs with missing/invalid factor values, unknown categorical levels, or malformed response strings ("12.5a")', () => {
      const runs: Run[] = [
        { id: 'run-1', stdOrder: 1, runOrder: 1, factors: { f1: 50, f2: 'EtOH' }, responses: { r1: 80 } },
        { id: 'run-2', stdOrder: 2, runOrder: 2, factors: { f1: 100, f2: 'EtOH' }, responses: { r1: 90 } },
        { id: 'run-3', stdOrder: 3, runOrder: 3, factors: { f1: 50, f2: 'MeOH' }, responses: { r1: 70 } },
        { id: 'run-4', stdOrder: 4, runOrder: 4, factors: { f1: 100, f2: 'MeOH' }, responses: { r1: 85 } },
        { id: 'run-5', stdOrder: 5, runOrder: 5, factors: { f1: 75, f2: 'EtOH' }, responses: { r1: 82 } },
        // Invalid runs that must be excluded and reported:
        { id: 'bad-num', stdOrder: 6, runOrder: 6, factors: { f1: '' as unknown as number, f2: 'EtOH' }, responses: { r1: 88 } },
        { id: 'bad-cat', stdOrder: 7, runOrder: 7, factors: { f1: 75, f2: 'Acetone' }, responses: { r1: 79 } },
        { id: 'bad-resp', stdOrder: 8, runOrder: 8, factors: { f1: 75, f2: 'MeOH' }, responses: { r1: '12.5a' as unknown as number } }
      ];

      const project: Project = {
        id: 'proj-val',
        name: 'Validation Study',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        factors,
        responses: [response],
        runs
      };

      const validation = validateRuns(project, response);
      expect(validation.validRuns).toHaveLength(5);
      expect(validation.excludedRuns.map(r => r.runId)).toEqual(['bad-num', 'bad-cat', 'bad-resp']);
      expect(validation.excludedRuns[0].reason).toContain('Temperature');
      expect(validation.excludedRuns[1].reason).toContain('Acetone');
      expect(validation.excludedRuns[2].reason).toContain('12.5a');

      const resWithInvalid = computeAnalysis(project, response);
      const resClean = computeAnalysis({ ...project, runs: runs.slice(0, 5) }, response);
      expect(resWithInvalid).not.toBeNull();
      expect(resClean).not.toBeNull();
      expect(resWithInvalid!.excludedRuns).toHaveLength(3);
      // Fitted coefficients must match the project where invalid runs were deleted
      expect(resWithInvalid!.parameterEstimates.map(pe => pe.estimate)).toEqual(
        resClean!.parameterEstimates.map(pe => pe.estimate)
      );
    });

    it('STAT-14: does not clamp coded values to [-2, 2] for axial/extrapolated settings and flags extrapolated runs', () => {
      const numFactor: Factor = { id: 'x', name: 'X', unit: '', type: 'numeric', min: 10, max: 20 };
      // Midpoint is 15, half-range is 5. At x = 30, true coded value is (30 - 15) / 5 = +3.
      const contrastsAt30 = getFactorContrasts(numFactor, 30);
      expect(contrastsAt30).toEqual([3]);

      // Fit a known quadratic truth y = 10 + 4*x_coded + 2*x_coded^2 including an axial point at coded +2.378
      const levels = [10, 12.5, 15, 17.5, 20, 26.89]; // 26.89 -> coded +2.378
      const quadRuns: Run[] = levels.map((xVal, idx) => {
        const z = (xVal - 15) / 5;
        return {
          id: `q-${idx + 1}`,
          stdOrder: idx + 1,
          runOrder: idx + 1,
          factors: { x: xVal },
          responses: { r1: 10 + 4 * z + 2 * z * z }
        };
      });
      const quadProject: Project = {
        id: 'proj-quad-extrap',
        name: 'Quad Extrap',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        factors: [numFactor],
        responses: [response],
        runs: quadRuns
      };

      const analysis = computeAnalysis(quadProject, response);
      expect(analysis).not.toBeNull();
      // Should flag the extrapolated run (x = 26.89 > max 20) in warnings
      expect(analysis!.warnings.some(w => w.includes('outside [min, max]'))).toBe(true);

      // Prediction at coded +3 (x = 30) must equal 10 + 4*(3) + 2*(9) = 40, not clamped to +2 (10 + 8 + 8 = 26)
      const predAt30 = predictModelResponse(analysis!, { x: 30 }, quadProject);
      expect(predAt30).toBeCloseTo(40, 8);
    });
  });

  describe('P1.18 (DES-5, MCP-13): Correct D-efficiency', () => {
    it('DES-5: returns 100 for an orthogonal 2^3 full factorial, null for singular designs, and never exceeds 100', () => {
      const fullFactorial2x3 = [
        [1, -1, -1, -1],
        [1, 1, -1, -1],
        [1, -1, 1, -1],
        [1, 1, 1, -1],
        [1, -1, -1, 1],
        [1, 1, -1, 1],
        [1, -1, 1, 1],
        [1, 1, 1, 1]
      ];
      const effOrtho = computeDEfficiency(fullFactorial2x3);
      expect(effOrtho).not.toBeNull();
      expect(effOrtho!).toBeCloseTo(100, 8);

      // Singular design with N < p returns null
      const singularMatrix = [
        [1, -1, -1, -1],
        [1, 1, 1, 1]
      ];
      expect(computeDEfficiency(singularMatrix)).toBeNull();

      // Duplicate rows making rank(X) < p returns null
      const rankDeficient = [
        [1, -1, -1],
        [1, -1, -1],
        [1, 1, 1],
        [1, 1, 1]
      ];
      expect(computeDEfficiency(rankDeficient)).toBeNull();

      // D-optimal subset with 3 factors and 6 runs has 0 < dEfficiency <= 100
      const factors: Factor[] = [
        { id: 'f1', name: 'A', unit: '', type: 'numeric', min: -1, max: 1 },
        { id: 'f2', name: 'B', unit: '', type: 'numeric', min: -1, max: 1 },
        { id: 'f3', name: 'C', unit: '', type: 'numeric', min: -1, max: 1 }
      ];
      const candidates = fullFactorial2x3.map(row => ({ f1: row[1], f2: row[2], f3: row[3] }));
      const sub = generateDOptimalSubset(candidates, factors, 6);
      expect(sub.dEfficiency).not.toBeNull();
      expect(sub.dEfficiency!).toBeGreaterThan(0);
      expect(sub.dEfficiency!).toBeLessThanOrEqual(100);
    });

    it('MCP-13: MCP generate_doe_design reports D-efficiency on [0, 100]% scale (never "10000.0%")', async () => {
      const projects: Project[] = [
        {
          id: 'proj-deff',
          name: 'DEff Test',
          description: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          factors: [
            { id: 'f1', name: 'A', unit: '', type: 'numeric', min: 10, max: 20 },
            { id: 'f2', name: 'B', unit: '', type: 'numeric', min: 1, max: 5 },
            { id: 'f3', name: 'C', unit: '', type: 'numeric', min: 100, max: 200 }
          ],
          responses: [{ id: 'r1', name: 'Yield', unit: '%', goal: 'maximize' }],
          runs: []
        }
      ];
      const { callTool, close } = await connectMcp(projects);
      try {
        const res = await callTool('generate_doe_design', {
          projectId: 'proj-deff',
          designType: 'factorial_2level',
          centerPoints: 0
        });
        expect(res.text).toContain('100.0%');
        expect(res.text).not.toContain('10000.0%');
      } finally {
        await close();
      }
    });
  });

  describe('P1.19 (DES-7): Valid, reproducible randomisation', () => {
    const factors: Factor[] = [
      { id: 'f1', name: 'A', unit: '', type: 'numeric', min: 0, max: 10 },
      { id: 'f2', name: 'B', unit: '', type: 'numeric', min: 0, max: 10 },
      { id: 'f3', name: 'C', unit: '', type: 'numeric', min: 0, max: 10 }
    ];
    const responses: Response[] = [{ id: 'r1', name: 'Y', unit: '', goal: 'maximize' }];

    it('produces identical run orders for the same seed, different orders for different seeds, and preserves unique stdOrder 1..N', () => {
      const gen1 = generateDesign(factors, responses, 'factorial_2level', {
        centerPoints: 2,
        randomize: true,
        randomSeed: 123456
      });
      const gen2 = generateDesign(factors, responses, 'factorial_2level', {
        centerPoints: 2,
        randomize: true,
        randomSeed: 123456
      });
      const gen3 = generateDesign(factors, responses, 'factorial_2level', {
        centerPoints: 2,
        randomize: true,
        randomSeed: 654321
      });

      expect(gen1.runs.map(r => r.stdOrder)).toEqual(gen2.runs.map(r => r.stdOrder));
      expect(gen1.runs.map(r => r.stdOrder)).not.toEqual(gen3.runs.map(r => r.stdOrder));

      // stdOrder must be a permutation of 1..N, and runOrder must be 1..N
      const N = gen1.runs.length;
      expect(gen1.runs.map(r => r.runOrder)).toEqual(Array.from({ length: N }, (_, i) => i + 1));
      expect([...gen1.runs.map(r => r.stdOrder)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: N }, (_, i) => i + 1)
      );

      // When randomize: false, stdOrder equals runOrder
      const unshuffled = generateDesign(factors, responses, 'factorial_2level', {
        centerPoints: 2,
        randomize: false
      });
      expect(unshuffled.runs.map(r => r.stdOrder)).toEqual(unshuffled.runs.map(r => r.runOrder));
    });

    it('assigns unique stdOrder 1..N across all design types (factorial, PB, DSD, CCD, BBD, D-optimal)', () => {
      for (const dt of ['factorial_2level', 'plackett_burman', 'dsd', 'ccd', 'bbd', 'custom_d_optimal'] as const) {
        const res = generateDesign(factors, responses, dt, { centerPoints: 2, randomSeed: 42 });
        const N = res.runs.length;
        const stdOrders = [...res.runs.map(r => r.stdOrder)].sort((a, b) => a - b);
        expect(stdOrders).toEqual(Array.from({ length: N }, (_, i) => i + 1));
      }
    });
  });

  describe('P1.20 (DES-6, DES-19, DES-20, DES-21): Honour the centre-point setting', () => {
    const numFactors: Factor[] = [
      { id: 'f1', name: 'A', unit: '', type: 'numeric', min: 10, max: 20 },
      { id: 'f2', name: 'B', unit: '', type: 'numeric', min: 100, max: 200 },
      { id: 'f3', name: 'C', unit: '', type: 'numeric', min: 0, max: 10 }
    ];
    const responses: Response[] = [{ id: 'r1', name: 'Y', unit: '', goal: 'maximize' }];

    it('DES-6 & DES-21: centerPoints = 0 produces 0 centre runs and centerPoints = 4 produces 4 centre runs across design types', () => {
      const isCenterRun = (r: Run) =>
        r.factors.f1 === 15 && r.factors.f2 === 150 && r.factors.f3 === 5;

      for (const dt of ['factorial_2level', 'plackett_burman', 'dsd', 'ccd', 'bbd', 'custom_d_optimal'] as const) {
        const res0 = generateDesign(numFactors, responses, dt, { centerPoints: 0, randomize: false });
        expect(res0.runs.filter(isCenterRun)).toHaveLength(0);

        const res4 = generateDesign(numFactors, responses, dt, { centerPoints: 4, randomize: false });
        expect(res4.runs.filter(isCenterRun).length).toBeGreaterThanOrEqual(4);
        expect(res4.runs.length - res0.runs.length).toBe(4);
      }
    });

    it('DES-6: distributes categorical factor levels evenly across centre points', () => {
      const mixedFactors: Factor[] = [
        { id: 'f1', name: 'Temp', unit: '', type: 'numeric', min: 10, max: 20 },
        { id: 'f2', name: 'Cat', unit: '', type: 'categorical', min: 0, max: 2, levels: ['L1', 'L2', 'L3'] }
      ];
      const cp = buildCenterPointRuns(mixedFactors, responses, 6, 1);
      expect(cp.runs).toHaveLength(6);
      expect(cp.runs.map(r => r.factors.f2)).toEqual(['L1', 'L2', 'L3', 'L1', 'L2', 'L3']);
    });

    it('DES-19: returns 0 centre points and a warning when all factors are categorical', () => {
      const catOnly: Factor[] = [
        { id: 'c1', name: 'Solvent', unit: '', type: 'categorical', min: 0, max: 1, levels: ['A', 'B'] },
        { id: 'c2', name: 'Base', unit: '', type: 'categorical', min: 0, max: 1, levels: ['X', 'Y'] }
      ];
      const cp = buildCenterPointRuns(catOnly, responses, 3, 1);
      expect(cp.runs).toHaveLength(0);
      expect(cp.warning).toContain('continuous');
    });

    it('DES-20: never writes undefined into run.factors even when a categorical factor has levels: []', () => {
      const emptyLevelsFactors: Factor[] = [
        { id: 'f1', name: 'Temp', unit: '', type: 'numeric', min: 10, max: 20 },
        { id: 'c1', name: 'BrokenCat', unit: '', type: 'categorical', min: 0, max: 1, levels: [] }
      ];
      const cp = buildCenterPointRuns(emptyLevelsFactors, responses, 2, 1);
      for (const r of cp.runs) {
        expect(r.factors.c1).toBeDefined();
        expect(typeof r.factors.c1).toBe('string');
      }
      const axial = buildAxialPointRuns(emptyLevelsFactors, responses, 1);
      for (const r of axial.runs) {
        expect(r.factors.c1).toBeDefined();
        expect(typeof r.factors.c1).toBe('string');
      }
    });
  });

  describe('P1.21 (STAT-10, UI-10): Optimizer accepts a target of 0', () => {
    it('preserves targetValue = 0 and throws when goal === "target" has no finite targetValue', () => {
      const optsZero = buildOptimizationOptions({ goal: 'target', targetValue: 0 });
      expect(optsZero.goal).toBe('target');
      expect(optsZero.targetValue).toBe(0);

      const optsZeroStr = buildOptimizationOptions({ goal: 'target', targetValue: '0' });
      expect(optsZeroStr.targetValue).toBe(0);

      expect(() => buildOptimizationOptions({ goal: 'target', targetValue: '' })).toThrow(/numeric target value/i);
      expect(() => buildOptimizationOptions({ goal: 'target', targetValue: undefined })).toThrow(/numeric target value/i);
    });
  });

  describe('P1.4 (UI-11): Escape the HTML export', () => {
    it('escapes <img src=x onerror=alert(1)> and A & B in project name, description, factor, level, and response', () => {
      const xssPayload = '<img src=x onerror=alert(1)>';
      const ampPayload = 'A & B';
      const project: Project = {
        id: 'proj-xss',
        name: `${xssPayload} ${ampPayload}`,
        description: `Desc ${xssPayload}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        randomSeed: 98765,
        factors: [
          { id: 'f1', name: `Factor ${xssPayload}`, unit: ampPayload, type: 'numeric', min: 0, max: 10 },
          { id: 'f2', name: `Cat ${ampPayload}`, unit: '', type: 'categorical', min: 0, max: 1, levels: [xssPayload, ampPayload] }
        ],
        responses: [
          { id: 'r1', name: `Resp ${xssPayload}`, unit: ampPayload, goal: 'maximize' }
        ],
        runs: [
          { id: 'run-1', stdOrder: 1, runOrder: 1, factors: { f1: 0, f2: xssPayload }, responses: { r1: 10 } },
          { id: 'run-2', stdOrder: 2, runOrder: 2, factors: { f1: 10, f2: ampPayload }, responses: { r1: 20 } },
          { id: 'run-3', stdOrder: 3, runOrder: 3, factors: { f1: 0, f2: ampPayload }, responses: { r1: 15 } },
          { id: 'run-4', stdOrder: 4, runOrder: 4, factors: { f1: 10, f2: xssPayload }, responses: { r1: 25 } }
        ]
      };

      const html = generateExportHTML(project, 'en');
      // Raw unescaped payload must never appear anywhere in the HTML document
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      // Escaped entities must appear
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('A &amp; B');
      expect(html).toContain('Seed: 98765');
    });
  });

  describe('P1.14 (MCP-4): Exact lookup for MCP write tools', () => {
    const makeBaseProject = (id: string, name: string): Project => ({
      id,
      name,
      description: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      factors: [{ id: 'f1', name: 'Temp', unit: 'C', type: 'numeric', min: 20, max: 80 }],
      responses: [{ id: 'r1', name: 'Yield', unit: '%', goal: 'maximize' }],
      runs: [
        { id: 'run-1', stdOrder: 1, runOrder: 1, factors: { f1: 20 }, responses: { r1: null } },
        { id: 'run-2', stdOrder: 2, runOrder: 2, factors: { f1: 80 }, responses: { r1: null } }
      ]
    });

    it('rejects empty/whitespace projectId, partial project names, ambiguous duplicate names, and partial response keys; archives first on delete_project', async () => {
      const projects: Project[] = [
        makeBaseProject('p-screen-1', 'Screen 1'),
        makeBaseProject('p-screen-2', 'Screen 2'),
        makeBaseProject('p-dup-a', 'Duplicate Study'),
        makeBaseProject('p-dup-b', 'Duplicate Study')
      ];

      const { callTool, store, close } = await connectMcp(projects);
      try {
        // 1. Empty/whitespace projectId is rejected and deletes nothing
        const emptyDel = await callTool('delete_project', { projectId: '   ' });
        expect(emptyDel.isError).toBe(true);
        expect(store).toHaveLength(4);

        // 2. Partial name 'Screen' with 'Screen 1' and 'Screen 2' returns not-found error
        const partialDel = await callTool('delete_project', { projectId: 'Screen' });
        expect(partialDel.isError).toBe(true);
        expect(partialDel.text).toContain('not found');
        expect(store).toHaveLength(4);

        // 3. Duplicate names return an "ambiguous" error listing both IDs
        const dupUpd = await callTool('update_project', {
          projectId: 'Duplicate Study',
          description: 'Updated'
        });
        expect(dupUpd.isError).toBe(true);
        expect(dupUpd.text.toLowerCase()).toContain('ambiguous');
        expect(dupUpd.text).toContain('p-dup-a');
        expect(dupUpd.text).toContain('p-dup-b');

        // 4. add_run_results rejects partial response key 'Yie'
        const badResp = await callTool('add_run_results', {
          projectId: 'p-screen-1',
          runs: [{ runOrder: 1, responses: { Yie: 88.5 } }]
        });
        expect(badResp.isError).toBe(true);
        expect(badResp.text).toContain("Response 'Yie' not found");
        expect(store[0].runs[0].responses.r1).toBeNull();

        // Exact response name 'Yield' succeeds
        const goodResp = await callTool('add_run_results', {
          projectId: 'Screen 1',
          runs: [{ runOrder: 1, responses: { Yield: 88.5 } }]
        });
        expect(goodResp.isError).toBe(false);
        expect(store[0].runs[0].responses.r1).toBe(88.5);

        // 5. delete_project archives first when not archived, then permanently deletes on second call
        const firstDel = await callTool('delete_project', { projectId: 'p-screen-2' });
        expect(firstDel.isError).toBe(false);
        expect(store.find(p => p.id === 'p-screen-2')?.isArchived).toBe(true);

        const secondDel = await callTool('delete_project', { projectId: 'p-screen-2' });
        expect(secondDel.isError).toBe(false);
        expect(store.find(p => p.id === 'p-screen-2')).toBeUndefined();
      } finally {
        await close();
      }
    });
  });
});
