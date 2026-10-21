// Loads the reference fixtures in tests/fixtures/ and runs the engine on them.
// Fixture format and provenance rules: tests/fixtures/README.md.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeAnalysis } from '../../src/core/analysis/analysisCore';
import type { Factor, Project, Response } from '../../src/core/types';

export interface ReferenceCoefficient {
  estimate: number;
  stdError?: number;
  tRatio?: number;
  pValue?: number;
  vif?: number;
}

export interface ReferenceModel {
  name: string;
  responseId: string;
  excludedTerms: string[];
  n: number;
  rank: number;
  dfModel: number;
  dfError: number;
  aliasedColumns: string[];
  sse: number;
  sst: number;
  rSquared: number;
  coefficients: Record<string, ReferenceCoefficient>;
  fitted: number[];
  leverage: number[];
  lackOfFit: { ssPure: number; dfPure: number; ssLof: number; dfLof: number; fLof: number | null; pLof: number | null };
  // Present when dfError > 0.
  mse?: number;
  rmse?: number;
  adjRSquared?: number;
  fRatio?: number | null;
  modelPValue?: number | null;
  studentizedResiduals?: number[];
  cooksDistance?: number[];
  adequatePrecision?: number;
  typeIII?: Record<string, { name: string; df: number; ss: number; fRatio: number; pValue: number }>;
  boxCox?: { shift: number; optimalLambda: number; grid: { lambda: number; logLikelihood: number }[] };
  // Present when dfError = 0 (saturated): Lenth (1989) on the 1-df contrasts, effect = 2β.
  lenth?: { contrasts: Record<string, number>; s0: number; PSE: number; df: number; ME: number; SME: number; t: Record<string, number> };
}

export interface Fixture {
  id: string;
  title: string;
  provenance: { data: string; published: string; derived: string; recorded: string };
  factors: Factor[];
  responses: Pick<Response, 'id' | 'name' | 'unit' | 'goal' | 'targetValue'>[];
  runs: { label: string; factors: Record<string, string | number>; responses: Record<string, number | null> }[];
  models: { name: string; responseId: string; excludedTerms: string[] }[];
  published?: Record<string, any>;
  reference: { tool: string; computed: string; models: ReferenceModel[] };
}

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

export function loadFixture(id: string): Fixture {
  return JSON.parse(fs.readFileSync(`${FIXTURES}${id}.json`, 'utf8'));
}

export function fixtureProject(fx: Fixture): Project {
  return {
    id: `fixture-${fx.id}`,
    name: fx.title,
    description: fx.provenance.data,
    factors: fx.factors,
    responses: fx.responses.map((r) => ({ ...r })),
    runs: fx.runs.map((r, i) => ({ id: `run-${i + 1}`, runOrder: i + 1, stdOrder: i + 1, factors: { ...r.factors }, responses: { ...r.responses } })),
    createdAt: 0,
    updatedAt: 0,
  };
}

export type Analysis = NonNullable<ReturnType<typeof computeAnalysis>>;

export function analyse(project: Project, responseId: string, excludedTerms: string[] = []): Analysis {
  const response = project.responses.find((r) => r.id === responseId);
  if (!response) throw new Error(`no response ${responseId}`);
  const result = computeAnalysis(project, response, excludedTerms, response.goal, response.targetValue);
  if (!result) throw new Error('computeAnalysis returned null');
  return result;
}

// Runs the engine on model `index` of a fixture and returns it with the matching reference block.
export function analyseFixture(id: string, index = 0) {
  const fixture = loadFixture(id);
  const model = fixture.models[index];
  const project = fixtureProject(fixture);
  const ref = fixture.reference.models[index];
  if (ref.name !== model.name) throw new Error(`${id}: reference block is stale; rerun tests/fixtures/compute_reference.py`);
  return { fixture, project, model, ref, result: analyse(project, model.responseId, model.excludedTerms) };
}
