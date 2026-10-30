/**
 * Pure, reproducible randomisation helpers for experimental runs (P1.19 / DES-7).
 */

/**
 * Creates a deterministic 32-bit PRNG (SplitMix32-initialized Mulberry32) from a numeric seed.
 */
export function createSeededRng(seed: number): () => number {
  let s = (Math.floor(seed) ^ 0x9E3779B9) >>> 0;
  if (s === 0) s = 0x6D2B79F5;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a fresh positive 31-bit integer seed.
 */
export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2147483646) + 1;
}

/**
 * Pure Fisher-Yates randomisation of run order (P1.19 / DES-7).
 * - Preserves unique `stdOrder` (`1..N`) if already unique, or assigns `1..N` sequentially before shuffling.
 * - Shuffles a shallow clone of `runs` using a seeded PRNG (`seed` defaults to `generateRandomSeed()`).
 * - Assigns sequential `runOrder` (`1..N`) to the shuffled result.
 */
export function randomize<T extends { runOrder: number; stdOrder: number }>(
  runs: readonly T[],
  seed?: number
): T[] {
  const effectiveSeed = seed !== undefined && Number.isFinite(seed) ? Math.floor(seed) : generateRandomSeed();
  const rng = createSeededRng(effectiveSeed);

  // Ensure stdOrder is 1..N unique before shuffling
  const stdSet = new Set(runs.map(r => r.stdOrder));
  const hasUniqueStdOrder =
    stdSet.size === runs.length &&
    runs.every(r => Number.isInteger(r.stdOrder) && r.stdOrder >= 1 && r.stdOrder <= runs.length);

  const items: T[] = runs.map((r, idx) => ({
    ...r,
    stdOrder: hasUniqueStdOrder ? r.stdOrder : idx + 1,
  }));

  // Standard Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }

  return items.map((r, idx) => ({
    ...r,
    runOrder: idx + 1,
  }));
}
