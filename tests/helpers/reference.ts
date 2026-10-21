// Comparisons of engine output with a fixture's reference block (tests/fixtures/compute_reference.py).
// Each check covers one group of numbers, so a test that pins a known bug fails only on that group.
import { expect, it } from 'vitest';
import type { Analysis, ReferenceModel } from './fixtures';

const REL = 1e-8;
const ABS = 1e-9;

export function expectClose(actual: unknown, expected: number, label: string, rel = REL, abs = ABS): void {
  expect(typeof actual, `${label}: not a number (${String(actual)})`).toBe('number');
  const tol = abs + rel * Math.abs(expected);
  expect(Math.abs((actual as number) - expected), `${label}: engine ${actual}, reference ${expected}`).toBeLessThanOrEqual(tol);
}

// p-values: the engine computes 1 − cdf, which loses relative precision below about 1e-12.
const expectP = (actual: unknown, expected: number, label: string) => expectClose(actual, expected, label, 1e-6, 1e-12);

function estimateRows(result: Analysis) {
  return (result.parameterEstimates as any[]).filter((r) => !r.isReference);
}

function row(result: Analysis, term: string) {
  const r = estimateRows(result).find((x) => x.term === term);
  expect(r, `parameter estimate row "${term}"`).toBeDefined();
  return r;
}

// β for every estimable column; aliased columns flagged as aliased; no other columns.
export function checkCoefficients(result: Analysis, ref: ReferenceModel): void {
  for (const [term, c] of Object.entries(ref.coefficients)) {
    const r = row(result, term);
    expect(r.isAliased, `${term} isAliased`).toBe(false);
    expectClose(r.estimate, c.estimate, `${term} estimate`);
  }
  for (const term of ref.aliasedColumns) expect(row(result, term).isAliased, `${term} isAliased`).toBe(true);
  const known = new Set([...Object.keys(ref.coefficients), ...ref.aliasedColumns]);
  expect(estimateRows(result).map((r) => r.term).filter((t) => !known.has(t)), 'unexpected parameter rows').toEqual([]);
}

// Standard error, t ratio and p-value of every estimable column.
export function checkInference(result: Analysis, ref: ReferenceModel): void {
  for (const [term, c] of Object.entries(ref.coefficients)) {
    const r = row(result, term);
    expectClose(r.stdError, c.stdError!, `${term} stdError`);
    expectClose(r.tRatio, c.tRatio!, `${term} tRatio`);
    expectP(r.pVal, c.pValue!, `${term} pVal`);
  }
}

// VIF of every estimable column. The engine floors at 1 and rounds to 3 decimals.
export function checkVif(result: Analysis, ref: ReferenceModel): void {
  for (const [term, c] of Object.entries(ref.coefficients)) {
    if (term === 'Intercept') continue;
    expectClose(row(result, term).vif, Math.max(1, c.vif!), `${term} vif`, 0, 5e-4);
  }
}

// Whole-model ANOVA. `p` is the model DF today (MCP-1); the model p-value is checked separately.
export function checkAnova(result: Analysis, ref: ReferenceModel): void {
  expect(result.nRuns, 'nRuns').toBe(ref.n);
  expect(result.dfError, 'dfError').toBe(ref.dfError);
  expect(result.p, 'p (model DF)').toBe(ref.dfModel);
  expectClose(result.lackOfFit.sse, ref.sse, 'SSE', REL, 1e-7);
  expectClose(result.lackOfFit.sst, ref.sst, 'SST');
  expectClose(result.rSquared, ref.rSquared, 'rSquared');
  expectClose(result.adjRSquared, ref.adjRSquared!, 'adjRSquared');
  expectClose(result.mse, ref.mse!, 'mse');
  expectClose(result.rmse, ref.rmse!, 'rmse');
  expectClose(result.fRatio, ref.fRatio!, 'fRatio');
}

// Type III (partial) sums of squares, F and p of every estimable term.
export function checkTypeIII(result: Analysis, ref: ReferenceModel): void {
  for (const [id, t] of Object.entries(ref.typeIII!)) {
    const e = (result.effectSummary as any[]).find((x) => x.id === id);
    expect(e, `effect test for ${id}`).toBeDefined();
    expect(e.df, `${id} df`).toBe(t.df);
    expectClose(e.ss, t.ss, `${id} SS`, REL, 1e-7);
    expectClose(e.fRatio, t.fRatio, `${id} F`);
    expectClose(e.pVal, Math.max(t.pValue, 1e-15), `${id} p`, 1e-6, 1e-12);
  }
}

export function checkLackOfFit(result: Analysis, ref: ReferenceModel): void {
  const lof = result.lackOfFit;
  const r = ref.lackOfFit;
  expect(lof.df_pure, 'df pure error').toBe(r.dfPure);
  expect(lof.df_lof, 'df lack of fit').toBe(r.dfLof);
  expectClose(lof.ss_pure, r.ssPure, 'SS pure error', REL, 1e-7);
  expectClose(lof.ss_lof, r.ssLof, 'SS lack of fit', REL, 1e-7);
  if (r.pLof === null) {
    expect(lof.p_lof, 'p lack of fit (not testable)').toBeNull();
  } else {
    expectClose(lof.f_lof, r.fLof!, 'F lack of fit');
    expectP(lof.p_lof, r.pLof, 'p lack of fit');
  }
}

// Fitted values at the design points (depend on β only).
export function checkFitted(result: Analysis, ref: ReferenceModel): void {
  (result.studentizedResiduals as any[]).forEach((s, i) => expectClose(s.predicted, ref.fitted[i], `fitted[${i}]`, REL, 1e-8));
}

// Leverage h_ii of every run (depends on (X'X)⁻¹).
export function checkLeverage(result: Analysis, ref: ReferenceModel): void {
  (result.studentizedResiduals as any[]).forEach((s, i) => expectClose(s.leverage, ref.leverage[i], `leverage[${i}]`));
}

// Internally studentized residuals and Cook's distance.
export function checkResidualDiagnostics(result: Analysis, ref: ReferenceModel): void {
  (result.studentizedResiduals as any[]).forEach((s, i) => {
    expectClose(s.studentized, ref.studentizedResiduals![i], `studentized[${i}]`, 1e-7, 1e-9);
    expectClose(s.cooksDistance, ref.cooksDistance![i], `cooksDistance[${i}]`, 1e-7, 1e-9);
  });
}

export function checkAdequatePrecision(result: Analysis, ref: ReferenceModel): void {
  expectClose(result.adequatePrecision, ref.adequatePrecision!, 'adequatePrecision');
}

// Box-Cox profile log-likelihood on the engine's grid (every second λ from −2 to 2).
export function checkBoxCox(result: Analysis, ref: ReferenceModel): void {
  const bc = result.boxCox;
  expect(bc, 'boxCox').not.toBeNull();
  for (const g of bc.grid as { lambda: number; logLikelihood: number }[]) {
    const r = ref.boxCox!.grid.find((x) => Math.abs(x.lambda - g.lambda) < 1e-9);
    expect(r, `reference λ = ${g.lambda}`).toBeDefined();
    expectClose(g.logLikelihood, r!.logLikelihood, `logL(λ = ${g.lambda})`, 1e-8, 1e-8);
  }
  expect(bc.optimalLambda, 'optimal λ').toBe(ref.boxCox!.optimalLambda);
}

// Σ h_ii = rank and 0 ≤ h_ii ≤ 1, which hold for any least-squares fit.
export function checkLeverageInvariants(result: Analysis, rank: number): void {
  const h = (result.studentizedResiduals as any[]).map((s) => s.leverage as number);
  expectClose(h.reduce((a, b) => a + b, 0), rank, 'Σ leverage = rank', 0, 1e-9);
  for (const [i, v] of h.entries()) {
    expect(v, `leverage[${i}] ≥ 0`).toBeGreaterThanOrEqual(-1e-12);
    expect(v, `leverage[${i}] ≤ 1`).toBeLessThanOrEqual(1 + 1e-12);
  }
}

// The estimate of a 1-df term by ID: 'Intercept', a factor id, or `${a}*${b}` for an interaction.
export function estimateOf(result: Analysis, id: string): number {
  const [a, b] = id.split('*');
  const r = id === 'Intercept'
    ? row(result, 'Intercept')
    : estimateRows(result).find((x) => (b ? x.f1Id === a && x.f2Id === b : x.factorId === a && !x.f1Id));
  expect(r, `parameter estimate for ${id}`).toBeDefined();
  return r.estimate;
}

// The standard comparison for a full-rank model with error DF > 0: every group must match.
export function itMatchesReference(fit: { result: Analysis; ref: ReferenceModel }): void {
  const { result, ref } = fit;
  it('coefficients and fitted values match the reference fit', () => {
    checkCoefficients(result, ref);
    checkFitted(result, ref);
  });
  it('standard errors, t ratios and p-values match', () => checkInference(result, ref));
  it('VIFs match', () => checkVif(result, ref));
  it('whole-model ANOVA (SSE, R², adjusted R², RMSE, F) matches', () => checkAnova(result, ref));
  it('Type III effect tests (SS, F, p) match', () => checkTypeIII(result, ref));
  it('lack of fit and pure error match', () => checkLackOfFit(result, ref));
  it("leverage, studentized residuals and Cook's distance match", () => {
    checkLeverageInvariants(result, ref.rank);
    checkLeverage(result, ref);
    checkResidualDiagnostics(result, ref);
  });
  it('adequate precision and the Box-Cox profile match', () => {
    checkAdequatePrecision(result, ref);
    checkBoxCox(result, ref);
  });
}
