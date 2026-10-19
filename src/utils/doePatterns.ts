import { Run, Factor } from '../types';

/**
 * Computes the DOE run pattern string (e.g. "+-+A", "---B", "○○○")
 * matching standard Design of Experiments software (JMP, Design-Expert):
 * - "+" for High factor level (+1)
 * - "-" for Low factor level (-1)
 * - "○" for Center point (0)
 * - Categorical letter (A, B, C...) or initial for discrete factors
 */
export function getRunPattern(run: Run, factors: Factor[]): string {
  if (!factors || factors.length === 0) return '';
  
  return factors.map(f => {
    if (f.type === 'categorical') {
      const rawVal = run.factors[f.id];
      if (rawVal === undefined || rawVal === null || rawVal === '') return '?';
      const valStr = String(rawVal).trim();
      if (f.levels && f.levels.length > 0) {
        const idx = f.levels.indexOf(valStr);
        if (idx !== -1) {
          return String.fromCharCode(65 + idx);
        }
      }
      return valStr.charAt(0).toUpperCase();
    }

    const rawVal = run.factors[f.id];
    if (rawVal === undefined || rawVal === null || rawVal === '') return '?';
    const num = Number(rawVal);
    if (isNaN(num)) return '?';

    const min = f.min;
    const max = f.max;
    const center = (min + max) / 2;
    const halfRange = Math.abs(max - min) / 2;

    if (halfRange < 1e-9) return '○';

    // Within 15% of half-range from center is considered a center point (○)
    if (Math.abs(num - center) <= halfRange * 0.15) {
      return '○';
    } else if (num > center) {
      return '+';
    } else {
      return '-';
    }
  }).join('');
}
