import { Factor, Project, Response, Run } from '../types';

export interface ExcludedRunInfo {
  runId: string;
  runOrder: number;
  reason: string;
}

export interface ValidatedRunsResult {
  validRuns: Run[];
  excludedRuns: ExcludedRunInfo[];
  warnings: string[];
}

function isStrictFiniteNumber(val: unknown): val is number | string {
  if (val === null || val === undefined || typeof val === 'boolean') return false;
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return false;
    return Number.isFinite(Number(trimmed));
  }
  return false;
}

/**
 * Validates project runs before model fitting (P1.11 / STAT-11, STAT-14, STAT-26).
 * - Excludes runs explicitly marked with `exclude: true`
 * - Excludes and reports runs with missing or non-finite numeric factor values
 * - Excludes and reports runs with unknown categorical factor levels
 * - Excludes and reports runs with missing or non-finite response values (rejecting strings like "12.5a")
 * - Flags runs with numeric factor values outside [min, max] in `warnings` as extrapolated
 */
export function validateRuns(project: Project, response?: Response): ValidatedRunsResult {
  const validRuns: Run[] = [];
  const excludedRuns: ExcludedRunInfo[] = [];
  const warnings: string[] = [];
  const extrapolatedFactors = new Set<string>();

  for (const r of project.runs) {
    if ((r as { exclude?: boolean }).exclude) {
      excludedRuns.push({
        runId: r.id,
        runOrder: r.runOrder,
        reason: 'Excluded by user',
      });
      continue;
    }

    let invalidReason: string | null = null;
    for (const f of project.factors) {
      const raw = r.factors[f.id] !== undefined ? r.factors[f.id] : r.factors[f.name];
      if (f.type === 'categorical') {
        const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
        const strVal = String(raw ?? '').trim().toLowerCase();
        const matched = strVal !== '' && levels.some(lv => String(lv).trim().toLowerCase() === strVal);
        if (!matched) {
          invalidReason = `Factor "${f.name}" has unknown categorical level "${String(raw ?? '')}" (allowed: ${levels.join(', ')})`;
          break;
        }
      } else {
        if (!isStrictFiniteNumber(raw)) {
          invalidReason = `Factor "${f.name}" has missing or non-finite numeric value "${String(raw ?? '')}"`;
          break;
        }
      }
    }

    if (invalidReason) {
      excludedRuns.push({
        runId: r.id,
        runOrder: r.runOrder,
        reason: invalidReason,
      });
      continue;
    }

    if (response) {
      const rawResp = r.responses[response.id] !== undefined
        ? r.responses[response.id]
        : r.responses[response.name];
      if (!isStrictFiniteNumber(rawResp)) {
        excludedRuns.push({
          runId: r.id,
          runOrder: r.runOrder,
          reason: `Response "${response.name}" has missing or non-finite value "${String(rawResp ?? '')}"`,
        });
        continue;
      }
    }

    // Check for extrapolation outside [min, max] on numeric factors (STAT-26)
    for (const f of project.factors) {
      if (f.type !== 'categorical') {
        const raw = r.factors[f.id] !== undefined ? r.factors[f.id] : r.factors[f.name];
        const numVal = Number(String(raw).trim());
        const lo = Math.min(f.min, f.max);
        const hi = Math.max(f.min, f.max);
        const span = hi - lo;
        const tol = span > 0 ? span * 1e-6 : 1e-9;
        if (numVal < lo - tol || numVal > hi + tol) {
          extrapolatedFactors.add(f.name);
        }
      }
    }

    validRuns.push(r);
  }

  if (extrapolatedFactors.size > 0) {
    warnings.push(
      `Extrapolation warning: one or more runs have numeric factor values outside [min, max] for ${Array.from(extrapolatedFactors).join(', ')}. Coded values were evaluated without clamping.`
    );
  }

  return { validRuns, excludedRuns, warnings };
}

/**
 * Generates contrast values for a factor in a given run.
 * - Numeric factors: scaled to [-1, +1] at [min, max] without clamping (STAT-26)
 * - 2-level Categorical factors: coded as [-1, +1]
 * - Multi-level Categorical factors (L >= 3): L-1 sum-to-zero effect-coded columns
 */
export function getFactorContrasts(factor: Factor, runVal: any): number[] {
  if (factor.type === 'categorical') {
    const levels = factor.levels && factor.levels.length > 0 ? factor.levels : ['Level 1', 'Level 2'];
    const L = levels.length;
    const strVal = String(runVal ?? '').trim().toLowerCase();
    let idx = levels.findIndex(lv => String(lv).trim().toLowerCase() === strVal);
    if (idx === -1) {
      const numIdx = Number(runVal);
      idx = !isNaN(numIdx) && numIdx >= 0 && numIdx < L ? Math.floor(numIdx) : 0;
    }

    if (L <= 2) {
      return [idx === 1 ? 1 : -1];
    }

    // L >= 3: L-1 columns using effect coding (sum-to-zero)
    const contrasts = new Array<number>(L - 1).fill(0);
    if (idx === L - 1) {
      for (let j = 0; j < L - 1; j++) contrasts[j] = -1;
    } else if (idx >= 0 && idx < L - 1) {
      contrasts[idx] = 1;
    }
    return contrasts;
  } else {
    const numVal = Number(runVal);
    if (!Number.isFinite(numVal)) return [0];
    const mid = (factor.min + factor.max) / 2;
    const halfRange = (factor.max - factor.min) / 2;
    if (halfRange === 0) return [0];
    const coded = (numVal - mid) / halfRange;
    return [coded];
  }
}

export interface ModelEffect {
  id: string;
  name: string;
  type: 'main' | 'interaction' | 'quadratic';
  factor?: Factor;
  f1?: Factor;
  f2?: Factor;
  df: number;
  columnNames: string[];
  cleanNames: string[];
  getContrasts: (factorsRecord: Record<string, any>) => number[];
  isExcluded: boolean;
  colIndices: number[]; // Column indices in X (1-based, after intercept 0)
}

/**
 * Counts distinct coded levels of a numeric factor across a set of runs or candidate settings.
 */
export function countDistinctNumericLevels(
  factor: Factor,
  factorRecords: Record<string, any>[]
): number {
  if (factor.type !== 'numeric') return 0;
  const distinct = new Set<number>();
  for (const rec of factorRecords) {
    const raw = rec[factor.id] !== undefined ? rec[factor.id] : rec[factor.name];
    const c = getFactorContrasts(factor, raw)[0];
    distinct.add(Math.round(c * 1e5) / 1e5);
  }
  return distinct.size;
}

/**
 * Determines whether quadratic terms (x_i^2) should be included in the model for a project.
 */
export function shouldIncludeQuadraticTerms(
  project: Project,
  validRuns: Run[]
): boolean {
  const dt = project.designType;
  if (dt === 'factorial_2level' || dt === 'plackett_burman') {
    return false;
  }

  const records = validRuns.map(r => r.factors);
  const numericFactors = project.factors.filter(f => f.type === 'numeric');
  const multiLevelNumeric = numericFactors.filter(f => countDistinctNumericLevels(f, records) >= 3);
  if (multiLevelNumeric.length === 0) {
    return false;
  }

  if (dt === 'ccd' || dt === 'bbd' || dt === 'dsd' || dt === 'custom_d_optimal') {
    return true;
  }

  // When designType is unset: check whether the 2FI model has spare degrees of freedom
  // and the squared columns are not merely a shared centre-point indicator on a 2-level design.
  let pMain = 1;
  project.factors.forEach(f => {
    pMain += f.type === 'categorical' && f.levels ? Math.max(1, f.levels.length - 1) : 1;
  });
  let pInt = 0;
  for (let i = 0; i < project.factors.length; i++) {
    const df1 = project.factors[i].type === 'categorical' && project.factors[i].levels
      ? Math.max(1, project.factors[i].levels!.length - 1) : 1;
    for (let j = i + 1; j < project.factors.length; j++) {
      const df2 = project.factors[j].type === 'categorical' && project.factors[j].levels
        ? Math.max(1, project.factors[j].levels!.length - 1) : 1;
      pInt += df1 * df2;
    }
  }
  if (validRuns.length <= pMain + pInt) {
    return false;
  }

  // Check if any run has a non-corner coded value on a subset of numeric factors, or axial levels (|x| != 1 and x != 0)
  for (const rec of records) {
    const codedVals = multiLevelNumeric.map(f => {
      const raw = rec[f.id] !== undefined ? rec[f.id] : rec[f.name];
      return getFactorContrasts(f, raw)[0];
    });
    const hasAxial = codedVals.some(c => Math.abs(c) > 1e-4 && Math.abs(Math.abs(c) - 1) > 1e-4);
    if (hasAxial) return true;
    const someZero = codedVals.some(c => Math.abs(c) <= 1e-4);
    const someNonZero = codedVals.some(c => Math.abs(c) > 1e-4);
    if (someZero && someNonZero) return true;
  }

  return false;
}

export interface ResolvedExclusions {
  excludedIds: string[];
  appliedTerms: { id: string; name: string }[];
  unknownTerms: string[];
  validTerms: { id: string; name: string }[];
}

/**
 * Resolves caller-provided excluded term strings (IDs, display names, column names,
 * or reversed interaction names/IDs like B*A) to canonical model effect IDs (P0.5 / MCP-7).
 */
export function resolveExcludedTerms(
  project: Project,
  validRuns: Run[],
  rawExcludedTerms: string[] = []
): ResolvedExclusions {
  const k = project.factors.length;
  const records = validRuns.map(r => r.factors);
  const includeQuadratics = shouldIncludeQuadraticTerms(project, validRuns);

  const termDefs: { id: string; name: string; aliases: string[] }[] = [];

  // 1. Main effects
  project.factors.forEach(f => {
    const aliases = [f.id, f.name];
    if (f.type === 'categorical') {
      const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
      levels.forEach(lv => aliases.push(`${f.name}[${lv}]`));
    }
    termDefs.push({ id: f.id, name: f.name, aliases });
  });

  // 2. Two-factor interactions
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const f1 = project.factors[i];
      const f2 = project.factors[j];
      const intId = `${f1.id}*${f2.id}`;
      const intName = `${f1.name}*${f2.name}`;
      const aliases = [
        intId,
        `${f2.id}*${f1.id}`,
        intName,
        `${f2.name}*${f1.name}`,
      ];
      const l1 = f1.type === 'categorical' ? (f1.levels && f1.levels.length > 0 ? f1.levels : ['Level 1', 'Level 2']).map(lv => `${f1.name}[${lv}]`) : [f1.name];
      const l2 = f2.type === 'categorical' ? (f2.levels && f2.levels.length > 0 ? f2.levels : ['Level 1', 'Level 2']).map(lv => `${f2.name}[${lv}]`) : [f2.name];
      for (const c1 of l1) {
        for (const c2 of l2) {
          aliases.push(`${c1}*${c2}`, `${c2}*${c1}`);
        }
      }
      termDefs.push({ id: intId, name: intName, aliases });
    }
  }

  // 3. Quadratic terms
  if (includeQuadratics) {
    project.factors.forEach(f => {
      if (f.type !== 'numeric') return;
      if (countDistinctNumericLevels(f, records) < 3) return;
      const quadId = `${f.id}^2`;
      const quadName = `${f.name}*${f.name}`;
      termDefs.push({
        id: quadId,
        name: quadName,
        aliases: [quadId, `${f.id}*${f.id}`, quadName, `${f.name}^2`],
      });
    });
  }

  const norm = (s: string) => s.trim().toLowerCase();
  const excludedIdSet = new Set<string>();
  const appliedTerms: { id: string; name: string }[] = [];
  const unknownTerms: string[] = [];

  for (const raw of rawExcludedTerms) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const key = norm(raw);
    const matched = termDefs.find(td => td.aliases.some(a => norm(a) === key));
    if (matched) {
      if (!excludedIdSet.has(matched.id)) {
        excludedIdSet.add(matched.id);
        appliedTerms.push({ id: matched.id, name: matched.name });
      }
    } else {
      unknownTerms.push(raw);
    }
  }

  return {
    excludedIds: Array.from(excludedIdSet),
    appliedTerms,
    unknownTerms,
    validTerms: termDefs.map(td => ({ id: td.id, name: td.name })),
  };
}

/**
 * Builds the model effect definitions (Main Effects, 2FIs, and Quadratic terms when applicable).
 */
export function buildModelEffects(
  project: Project,
  validRuns: Run[],
  excludedTerms: string[]
): {
  allEffects: ModelEffect[];
  activeEffects: ModelEffect[];
  numTerms: number;
  hasQuadraticTerms: boolean;
} {
  const allEffects: ModelEffect[] = [];
  const k = project.factors.length;
  const records = validRuns.map(r => r.factors);
  const { excludedIds } = resolveExcludedTerms(project, validRuns, excludedTerms);
  const excludedSet = new Set<string>(excludedIds);

  // 1. Main effects
  project.factors.forEach(f => {
    const isExcluded = excludedSet.has(f.id) || excludedTerms.includes(f.id);
    if (f.type === 'categorical') {
      const levels = f.levels && f.levels.length > 0 ? f.levels : ['Level 1', 'Level 2'];
      const L = levels.length;
      if (L <= 2) {
        const colName = `${f.name}[${levels[1]}]`;
        allEffects.push({
          id: f.id,
          name: f.name,
          type: 'main',
          factor: f,
          df: 1,
          columnNames: [colName],
          cleanNames: [colName],
          getContrasts: (rec) => getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]),
          isExcluded,
          colIndices: []
        });
      } else {
        const columnNames: string[] = [];
        for (let j = 0; j < L - 1; j++) {
          columnNames.push(`${f.name}[${levels[j]}]`);
        }
        allEffects.push({
          id: f.id,
          name: f.name,
          type: 'main',
          factor: f,
          df: L - 1,
          columnNames,
          cleanNames: [...columnNames],
          getContrasts: (rec) => getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]),
          isExcluded,
          colIndices: []
        });
      }
    } else {
      const colName = `${f.name}`;
      allEffects.push({
        id: f.id,
        name: f.name,
        type: 'main',
        factor: f,
        df: 1,
        columnNames: [colName],
        cleanNames: [f.name],
        getContrasts: (rec) => getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]),
        isExcluded,
        colIndices: []
      });
    }
  });

  // 2. Two-factor interactions
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const f1 = project.factors[i];
      const f2 = project.factors[j];
      const intId = `${f1.id}*${f2.id}`;
      const isExcluded = excludedSet.has(intId) || excludedTerms.includes(intId);

      const e1 = allEffects.find(e => e.type === 'main' && e.id === f1.id)!;
      const e2 = allEffects.find(e => e.type === 'main' && e.id === f2.id)!;
      const intDf = e1.df * e2.df;
      const columnNames: string[] = [];
      const cleanNames: string[] = [];

      e1.columnNames.forEach(c1 => {
        e2.columnNames.forEach(c2 => {
          const name = `${c1}*${c2}`;
          columnNames.push(name);
          cleanNames.push(name);
        });
      });

      allEffects.push({
        id: intId,
        name: `${f1.name}*${f2.name}`,
        type: 'interaction',
        f1,
        f2,
        df: intDf,
        columnNames,
        cleanNames,
        getContrasts: (rec) => {
          const c1 = e1.getContrasts(rec);
          const c2 = e2.getContrasts(rec);
          const res: number[] = [];
          for (let p = 0; p < c1.length; p++) {
            for (let q = 0; q < c2.length; q++) {
              res.push(c1[p] * c2[q]);
            }
          }
          return res;
        },
        isExcluded,
        colIndices: []
      });
    }
  }

  // 3. Quadratic terms (x_i^2) for numeric factors with >= 3 distinct levels
  const includeQuadratics = shouldIncludeQuadraticTerms(project, validRuns);
  let hasQuadraticTerms = false;

  if (includeQuadratics) {
    project.factors.forEach(f => {
      if (f.type !== 'numeric') return;
      if (countDistinctNumericLevels(f, records) < 3) return;
      const quadId = `${f.id}^2`;
      const altQuadId = `${f.id}*${f.id}`;
      const isExcluded = excludedSet.has(quadId) || excludedTerms.includes(quadId) || excludedTerms.includes(altQuadId);
      const colName = `${f.name}*${f.name}`;
      hasQuadraticTerms = true;

      allEffects.push({
        id: quadId,
        name: colName,
        type: 'quadratic',
        factor: f,
        f1: f,
        f2: f,
        df: 1,
        columnNames: [colName],
        cleanNames: [colName],
        getContrasts: (rec) => {
          const c = getFactorContrasts(f, rec[f.id] !== undefined ? rec[f.id] : rec[f.name]);
          return [c[0] * c[0]];
        },
        isExcluded,
        colIndices: []
      });
    });
  }

  // Assign column indices for active effects
  const activeEffects = allEffects.filter(e => !e.isExcluded);
  let currentCol = 1;
  activeEffects.forEach(e => {
    e.colIndices = [];
    for (let c = 0; c < e.df; c++) {
      e.colIndices.push(currentCol++);
    }
  });

  return {
    allEffects,
    activeEffects,
    numTerms: currentCol,
    hasQuadraticTerms
  };
}
