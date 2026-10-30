/**
 * Resolution table for regular 2^(k-p) fractional factorial designs (4 to 512 runs, 3 to 16 factors).
 *
 * Every cell matches the resolution computed by `getRegularFractionGenerators` / `computeFractionResolution`
 * in `src/core/design/fractions.ts`.
 *
 * Sources:
 * - Montgomery, D. C. (2013), Design and Analysis of Experiments, 8th ed., Table 8.14.
 * - Wu, C. F. J. & Hamada, M. S. (2009), Experiments: Planning, Analysis, and Optimization, 2nd ed., Tables 5A.
 * - NIST/SEMATECH e-Handbook of Statistical Methods, Section 5.3.3.4.7.
 *
 * Colour codes (all represented in TwoLevelDesignSelector legend):
 * - 'G': Resolution V or higher (Characterization)
 * - 'Y': Resolution IV (Screening)
 * - 'R': Resolution III (Ruggedness / saturated screening)
 */
export const designMatrix = {
  "4": {
    "3": { "p": "1", "res": "III", "color": "R" }
  },
  "8": {
    "4": { "p": "1", "res": "IV", "color": "Y" },
    "5": { "p": "2", "res": "III", "color": "R" },
    "6": { "p": "3", "res": "III", "color": "R" },
    "7": { "p": "4", "res": "III", "color": "R" }
  },
  "16": {
    "5": { "p": "1", "res": "V", "color": "G" },
    "6": { "p": "2", "res": "IV", "color": "Y" },
    "7": { "p": "3", "res": "IV", "color": "Y" },
    "8": { "p": "4", "res": "IV", "color": "Y" },
    "9": { "p": "5", "res": "III", "color": "R" },
    "10": { "p": "6", "res": "III", "color": "R" },
    "11": { "p": "7", "res": "III", "color": "R" },
    "12": { "p": "8", "res": "III", "color": "R" },
    "13": { "p": "9", "res": "III", "color": "R" },
    "14": { "p": "10", "res": "III", "color": "R" },
    "15": { "p": "11", "res": "III", "color": "R" }
  },
  "32": {
    "6": { "p": "1", "res": "VI", "color": "G" },
    "7": { "p": "2", "res": "IV", "color": "Y" },
    "8": { "p": "3", "res": "IV", "color": "Y" },
    "9": { "p": "4", "res": "IV", "color": "Y" },
    "10": { "p": "5", "res": "IV", "color": "Y" },
    "11": { "p": "6", "res": "IV", "color": "Y" },
    "12": { "p": "7", "res": "IV", "color": "Y" },
    "13": { "p": "8", "res": "IV", "color": "Y" },
    "14": { "p": "9", "res": "IV", "color": "Y" },
    "15": { "p": "10", "res": "IV", "color": "Y" },
    "16": { "p": "11", "res": "IV", "color": "Y" }
  },
  "64": {
    "7": { "p": "1", "res": "VII", "color": "G" },
    "8": { "p": "2", "res": "V", "color": "G" },
    "9": { "p": "3", "res": "IV", "color": "Y" },
    "10": { "p": "4", "res": "IV", "color": "Y" },
    "11": { "p": "5", "res": "IV", "color": "Y" },
    "12": { "p": "6", "res": "IV", "color": "Y" },
    "13": { "p": "7", "res": "IV", "color": "Y" },
    "14": { "p": "8", "res": "IV", "color": "Y" },
    "15": { "p": "9", "res": "IV", "color": "Y" },
    "16": { "p": "10", "res": "IV", "color": "Y" }
  },
  "128": {
    "8": { "p": "1", "res": "VIII", "color": "G" },
    "9": { "p": "2", "res": "VI", "color": "G" },
    "10": { "p": "3", "res": "V", "color": "G" },
    "11": { "p": "4", "res": "V", "color": "G" },
    "12": { "p": "5", "res": "IV", "color": "Y" },
    "13": { "p": "6", "res": "IV", "color": "Y" },
    "14": { "p": "7", "res": "IV", "color": "Y" },
    "15": { "p": "8", "res": "IV", "color": "Y" },
    "16": { "p": "9", "res": "IV", "color": "Y" }
  },
  "256": {
    "9": { "p": "1", "res": "IX", "color": "G" },
    "10": { "p": "2", "res": "VI", "color": "G" },
    "11": { "p": "3", "res": "VI", "color": "G" },
    "12": { "p": "4", "res": "VI", "color": "G" },
    "13": { "p": "5", "res": "V", "color": "G" },
    "14": { "p": "6", "res": "V", "color": "G" },
    "15": { "p": "7", "res": "V", "color": "G" },
    "16": { "p": "8", "res": "V", "color": "G" }
  },
  "512": {
    "10": { "p": "1", "res": "X", "color": "G" },
    "11": { "p": "2", "res": "VII", "color": "G" },
    "12": { "p": "3", "res": "VI", "color": "G" },
    "13": { "p": "4", "res": "VI", "color": "G" },
    "14": { "p": "5", "res": "VI", "color": "G" },
    "15": { "p": "6", "res": "VI", "color": "G" },
    "16": { "p": "7", "res": "VI", "color": "G" }
  }
};
