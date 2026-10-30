import { describe, expect, it } from 'vitest';
import type { Project } from '../../../src/core/types';
import { fitProjectModels, fitProjectModelsById } from '../../../src/core/analysis/projectModels';
import { computeAnalysis, predictModelResponse } from '../../../src/core/analysis/analysisCore';

function buildTwoResponseProject(): Project {
  const factors = [
    { id: 'A', name: 'Temperature', type: 'numeric' as const, min: 50, max: 90, unit: 'C' },
    { id: 'B', name: 'Time', type: 'numeric' as const, min: 1, max: 5, unit: 'h' },
    { id: 'C', name: 'Catalyst', type: 'numeric' as const, min: 0.5, max: 2.5, unit: '%' },
  ];
  const runs = Array.from({ length: 8 }, (_, r) => {
    const a = (r & 1) ? 1 : -1;
    const b = (r & 2) ? 1 : -1;
    const c = (r & 4) ? 1 : -1;
    return {
      id: `run-${r + 1}`,
      runOrder: r + 1,
      stdOrder: r + 1,
      factors: {
        A: a > 0 ? 90 : 50,
        B: b > 0 ? 5 : 1,
        C: c > 0 ? 2.5 : 0.5,
      },
      responses: {
        y1: 80 + 5 * a + 3 * b - 2 * c + 1.5 * a * b + 0.2 * a * c,
        y2: 20 - 4 * a + 6 * b + 2.5 * c - 3 * a * b + 1.8 * b * c,
      },
    };
  });

  return {
    id: 'two-resp-proj',
    name: 'Two Response Project',
    description: 'Test STAT-7 / UI-3 / P0.6',
    designType: 'factorial_2level',
    factors,
    responses: [
      { id: 'y1', name: 'Yield', unit: '%', goal: 'maximize', excludedTerms: ['C', 'A*C'] },
      { id: 'y2', name: 'Impurity', unit: '%', goal: 'minimize', excludedTerms: ['A', 'B*C'] },
    ],
    runs,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('STAT-7 / UI-3 (P0.6): fitProjectModels respects saved excludedTerms per response', () => {
  it('excludes response B saved terms regardless of which response is active', () => {
    const project = buildTwoResponseProject();

    // When response y1 is active in ProjectAnalysis
    const modelsWhenY1Active = fitProjectModels(project, {
      responseId: 'y1',
      excludedTerms: project.responses[0].excludedTerms,
    });
    // When response y2 is active in ProjectAnalysis
    const modelsWhenY2Active = fitProjectModels(project, {
      responseId: 'y2',
      excludedTerms: project.responses[1].excludedTerms,
    });

    const y2FromFirst = modelsWhenY1Active.find(m => m.response.id === 'y2')!;
    const y2FromSecond = modelsWhenY2Active.find(m => m.response.id === 'y2')!;
    const y2Direct = computeAnalysis(project, project.responses[1], project.responses[1].excludedTerms!, 'minimize', project.responses[1].targetValue);

    expect(y2FromFirst.parameterEstimates).toEqual(y2Direct.parameterEstimates);
    expect(y2FromSecond.parameterEstimates).toEqual(y2Direct.parameterEstimates);

    // Verify excluded terms ('A' and 'B*C') are not in parameterEstimates of y2
    const y2Terms = y2FromFirst.parameterEstimates.map((p: any) => p.term);
    expect(y2Terms).not.toContain('Temperature');
    expect(y2Terms).not.toContain('Time*Catalyst');

    // Verify prediction at an arbitrary setting matches Compare and MCP predict_response
    const testSettings = { A: 78, B: 2.2, C: 1.9 };
    const predProfilerWhenY1Active = predictModelResponse(y2FromFirst, testSettings, project);
    const predProfilerWhenY2Active = predictModelResponse(y2FromSecond, testSettings, project);
    const byId = fitProjectModelsById(project);
    const predCompareAndMcp = predictModelResponse(byId.y2, testSettings, project);

    expect(predProfilerWhenY1Active).toBeCloseTo(predCompareAndMcp, 10);
    expect(predProfilerWhenY2Active).toBeCloseTo(predCompareAndMcp, 10);
  });
});
